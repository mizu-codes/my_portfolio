#!/usr/bin/env python3
"""Rebuilds public/models/pc_monitor.glb from the unmodified download (public/models/pc_monitor.original.glb).

Edits the model's own geometry (casing, screen plane, foot plate and neck) and materials, and writes a new GLB already at final size in
monitor space. Needs only numpy.   Usage: python3 scripts/build-monitor-glb.py
See src/scene/monitorModel.ts for what is kept, changed and removed.
"""
import json, struct, pathlib
import numpy as np
from collections import defaultdict

# ---- minimal GLB reader ----
def read_glb(path):
    d=open(path,'rb').read()
    magic,ver,length=struct.unpack('<III',d[:12]); off=12; js=None; bin_=b''
    while off<length:
        cl,ct=struct.unpack('<II',d[off:off+8]); chunk=d[off+8:off+8+cl]; off+=8+cl
        if ct==0x4E4F534A: js=json.loads(chunk)
        elif ct==0x004E4942: bin_=chunk
    return js,bin_
CT={5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def accessor(js,bin_,i):
    a=js['accessors'][i]; bv=js['bufferViews'][a['bufferView']]
    dt=np.dtype(CT[a['componentType']]); n=NC[a['type']]
    off=bv.get('byteOffset',0)+a.get('byteOffset',0); stride=bv.get('byteStride',0)
    if stride and stride!=dt.itemsize*n:
        arr=np.ndarray((a['count'],n),dt,bin_,off,(stride,dt.itemsize))
    else:
        arr=np.frombuffer(bin_,dt,a['count']*n,off).reshape(a['count'],n)
    return arr.copy()

# ---- edit + export ----
"""Edits public/models/pc_monitor.glb itself (geometry + materials) and writes a new GLB in final monitor space (metres, scale baked in)."""

ROOT=pathlib.Path(__file__).resolve().parent.parent
SRC=str(ROOT/'public/models/pc_monitor.original.glb')
OUT=str(ROOT/'public/models/pc_monitor.glb')
S=1.75                       # same uniform scale the site already used
FRONT_Z=-0.014               # monitor-space z of casing front face (unchanged from layout.ts)
# ---- target proportions / thickness (final metres) ----
ASPECT=1.95                  # width : height measured on reference image 4 (745 x 377 px)
RIM=0.009                    # thin perimeter rim, front face -> rear edge
LIP=0.0025                   # screen recess depth behind the front face
RISE=0.022                   # rear taper from rim edge up to the flat middle
CLEAR=0.0875                 # desk -> casing lower edge
BEV_SIDE_FRAC, BEV_TOP_FRAC, BEV_BOT_FRAC = 0.13, 0.18, 0.15   # measured on image 4

js,bn=read_glb(SRC)
W=np.array([[1e-3,0,0],[0,1e-3,0],[0,0,1e-3]])
def baked(pi,ii):
    p=accessor(js,bn,pi).astype(float)*1e-3  # node chain is a pure x0.001 once the two 90deg rotations cancel
    return p, accessor(js,bn,ii).flatten().reshape(-1,3)
Pb,Ib=baked(0,3); Ps,Is=baked(4,7)
o=Pb.min(0); Pb-=o; Ps-=o
# weld body vertices by position
def weld(P,I):
    q=np.round(P*1e5).astype(np.int64); u,idx,inv=np.unique(q,axis=0,return_index=True,return_inverse=True)
    return P[idx], inv[I]
Pw,Iw=weld(Pb,Ib)
mn=Pw[Iw].min(1); mx=Pw[Iw].max(1)
casing=(mn[:,0]>=0.0795)&(mn[:,1]>=0.112)
stand =(~casing)&(mx[:,1]<0.125)            # foot plate + inclined neck (bracket/boss/cable behind the panel are dropped)
Fc=Iw[casing]; Fs=Iw[stand]
print('casing tris',len(Fc),'stand tris',len(Fs),'dropped',(~casing&~stand).sum())

# ---------- casing: compact, fill the hole the bracket boss left ----------
used=np.unique(Fc); remap=-np.ones(len(Pw),int); remap[used]=np.arange(len(used))
C=Pw[used].copy(); F=remap[Fc]
ed=defaultdict(list)
for t in F:
    for a,b in ((t[0],t[1]),(t[1],t[2]),(t[2],t[0])): ed[(min(a,b),max(a,b))].append((a,b))
bd=[v[0] for k,v in ed.items() if len(v)==1 and C[k[0],0]<0.09 and C[k[1],0]<0.09]
print('hole boundary edges',len(bd))
cen=C[np.unique(np.array(bd).flatten())].mean(0); ci=len(C); C=np.vstack([C,cen])
F=np.vstack([F,[[b,a,ci] for a,b in bd]])           # opposite direction to the neighbouring faces -> consistent winding
# ---------- casing geometry edit ----------
XP,EDGE=0.0816,0.1154; SCR=0.1575; FR=0.1641
ymin,ymax=C[:,1].min(),C[:,1].max(); zmin,zmax=C[:,2].min(),C[:,2].max(); Wd=zmax-zmin
Hn=Wd/ASPECT; sy=Hn/(ymax-ymin)
bs=BEV_SIDE_FRAC*Wd; bb=BEV_BOT_FRAC*Hn; bt=BEV_TOP_FRAC*Hn
rise=RISE/S; rim=RIM/S; lip=LIP/S
E=XP+rise; Fx=E+rim; Sx=Fx-lip
def pw(v,fr,to):
    return np.interp(v,fr,to)
yFrom=[ymin,0.214,0.381,ymax]; yTo=[ymin,ymin+bb,ymin+Hn-bt,ymin+Hn]
zFrom=[zmin,0.111,0.447,zmax]; zTo=[zmin,zmin+bs,zmax-bs,zmax]
rear=C[:,0]<0.118
N=C.copy()
# rear: keep mesh topology, re-sculpt into a clean four-sided taper (mitred frustum) with the new proportions
N[rear,1]=pw(C[rear,1],yFrom,yTo); N[rear,2]=pw(C[rear,2],zFrom,zTo)
# --- cut the triangles that straddle the four mitre lines of the taper, so the creases follow mesh edges (crisp, not stair-stepped) ---
def corner_fields(low_z,bottom):
    def dzf(P): return ((zmin+bs-P[:,2]) if low_z else (P[:,2]-(zmax-bs)))/bs
    def dyf(P): return (((ymin+bb)-P[:,1])/bb) if bottom else ((P[:,1]-(ymin+Hn-bt))/bt)
    return dzf,dyf
Nl=[r for r in N]; rear_l=list(rear)+[]
Flist=[tuple(f) for f in F]
cut_cache={}
def newvert(a,b,ha,hb):
    key=(min(a,b),max(a,b))
    if key in cut_cache: return cut_cache[key]
    t_=ha/(ha-hb) if a<b else None
    lo,hi=(a,b) if a<b else (b,a)
    hlo,hhi=(ha,hb) if a<b else (hb,ha)
    t_=hlo/(hlo-hhi)
    p=Nl[lo]+(Nl[hi]-Nl[lo])*t_
    Nl.append(p); rear_l.append(True); cut_cache[key]=len(Nl)-1; return cut_cache[key]
for low_z in (True,False):
    for bottom in (True,False):
        dzf,dyf=corner_fields(low_z,bottom)
        Narr=np.array(Nl); dzv=dzf(Narr); dyv=dyf(Narr); hv=dzv-dyv
        inz=(dzv>=-1e-5)&(dyv>=-1e-5)
        out=[]
        for f in Flist:
            a,b,c=f
            if not (inz[a] and inz[b] and inz[c]): out.append(f); continue
            h=[hv[a]>1e-9,hv[b]>1e-9,hv[c]>1e-9]
            if h[0]==h[1]==h[2]: out.append(f); continue
            vs=[a,b,c]
            # rotate so vs[0] is the lone vertex
            k=[i for i in range(3) if h[i]!=h[(i+1)%3] and h[i]!=h[(i+2)%3]][0]
            v0,v1,v2=vs[k],vs[(k+1)%3],vs[(k+2)%3]
            p=newvert(v0,v1,hv[v0],hv[v1]); q=newvert(v0,v2,hv[v0],hv[v2])
            out+= [(v0,p,q),(p,v1,v2),(p,v2,q)]
        Flist=out
        # fields must be recomputed for new verts next round
N=np.array(Nl); rear=np.array(rear_l); F=np.array(Flist)
C=np.vstack([C,np.zeros((len(N)-len(C),3))])  # keeps array lengths in step (original-x of new verts unused)
dz=np.maximum(0,np.maximum(zmin+bs-N[:,2],N[:,2]-(zmax-bs)))/bs
dyb=np.maximum(0,(ymin+bb)-N[:,1])/bb
dyt=np.maximum(0,N[:,1]-(ymin+Hn-bt))/bt
t=np.clip(np.maximum(dz,np.maximum(dyb,dyt)),0,1)
N[rear,0]=XP+rise*t[rear]
# rim wall, front bezel, recess: linear height squeeze, thin depth
fr=~rear
N[fr,1]=ymin+(C[fr,1]-ymin)*sy
N[fr,0]=np.interp(C[fr,0],[EDGE,SCR,FR],[E,Sx,Fx])
casing_raw=N
# screen plane (the model's own), same maps
Sp=Ps.copy(); Sp[:,1]=ymin+(Ps[:,1]-ymin)*sy; Sp[:,0]=Sx
Sw,Isw=weld(Sp,Is)

# ---------- stand: straighten, fit to new casing, keep foot plate ----------
SV=np.unique(Fs); sm=-np.ones(len(Pw),int); sm[SV]=np.arange(len(SV))
T=Pw[SV].copy(); FS=sm[Fs]
plate=T[:,1]<=0.0155
neck=~plate
# centre line of the inclined plate, x = a + b*y
A=np.polyfit(T[neck,1],T[neck,0],1)
c=lambda y: np.polyval(A,y)
y_b=T[neck,1].min(); y_t=T[:,1].max()
cx_new=XP+rise/2                   # neck centred in the casing's depth at its middle
neck_top=CLEAR/S+0.050             # buried well inside the casing so no end face shows
KX_PLATE=0.55; KX_NECK=1.15; KZ_NECK=0.80
zc=(zmin+zmax)/2
M=T.copy()
# plate: its mount stays under the neck; depth shrunk about the mount
M[plate,0]=cx_new+(T[plate,0]-c(y_b))*KX_PLATE
# neck: shear out the incline, thicken a touch, narrow slightly, compress to the new height
M[neck,0]=cx_new+(T[neck,0]-c(T[neck,1]))*KX_NECK
M[neck,2]=zc+(T[neck,2]-zc)*KZ_NECK
M[neck,1]=0.0149+(T[neck,1]-0.0149)*((neck_top-0.0149)/(y_t-0.0149))
stand_raw=M

# ---------- to monitor space ----------
shift_y=CLEAR/S-ymin
zMid=zc
def to_mon(P,raise_y=True):
    Q=np.empty_like(P)
    Q[:,0]=S*(P[:,2]-zMid)
    Q[:,1]=S*(P[:,1]+(shift_y if raise_y else 0))
    Q[:,2]=FRONT_Z-S*(P[:,0]-Fx)
    return Q
CasM=to_mon(casing_raw); ScrM=to_mon(Sw)
StM=stand_raw.copy(); StM[:,1]=stand_raw[:,1]+np.where(stand_raw[:,1]<=0.0155,0,0)   # stand sits on the desk: no lift
StM[:,1]=np.where(T[:,1]<=0.0155,T[:,1],stand_raw[:,1])
StM=to_mon(StM,raise_y=False)

# ---------- normals with crease splitting ----------
def build(Pv,Fv,crease_deg):
    tri=Pv[Fv]; fn=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]); area=np.linalg.norm(fn,axis=1); ok=area>1e-14
    fn[ok]/=area[ok,None]
    adj=defaultdict(list)
    for fi,f in enumerate(Fv):
        if not ok[fi]: continue
        for v in f: adj[v].append(fi)
    cs=np.cos(np.radians(crease_deg)); pos=[];nor=[];idx=[]
    for fi,f in enumerate(Fv):
        if not ok[fi]: continue
        for v in f:
            a=np.array(adj[v]); sel=a[(fn[a]@fn[fi])>=cs]
            n=(fn[sel]*area[sel,None]).sum(0); n/=max(np.linalg.norm(n),1e-12)
            idx.append(len(pos)); pos.append(Pv[v]); nor.append(n)
    return np.array(pos,np.float32),np.array(nor,np.float32),np.array(idx,np.uint32),fn,ok

# material split
# casing: rear taper (light) vs rim wall + front bezel (dark)
cen_x=casing_raw[F].mean(1)[:,0]
is_rear_face=(casing_raw[F][:,:,0]<=E+0.0007).all(1)
FR_rear=F[is_rear_face]; FR_rim=F[~is_rear_face]
# stand: foot-plate top faces light, rest dark
tri=StM[FS]; fn=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]); fn/=np.maximum(np.linalg.norm(fn,axis=1,keepdims=True),1e-12)
top=(fn[:,1]>0.7)&(tri[:,:,1].max(1)<0.0155*S+1e-4)
FS_top=FS[top]; FS_dark=FS[~top]

prims=[]
def add(name,Pv,Fv,mat,crease=5):
    p,n,i,_,_=build(Pv,Fv,crease)
    key=np.round(np.c_[p,n]*1e6).astype(np.int64); _,first,inv=np.unique(key,axis=0,return_index=True,return_inverse=True)
    prims.append((name,p[first],n[first],inv.astype(np.uint32).reshape(-1),mat))
add('casing_rear',CasM,FR_rear,0)
add('casing_rim_bezel',CasM,FR_rim,1)
add('stand_top',StM,FS_top,3,30)
add('stand_body',StM,FS_dark,4,30)
# screen: planar grid, regenerate 0..1 UVs (u to the viewer's right as seen from the robot side)
sp,sn,si,_,_=build(ScrM,Isw,10)
key=np.round(sp*1e7).astype(np.int64); _,first,inv=np.unique(key,axis=0,return_index=True,return_inverse=True); sp=sp[first]; si=inv.astype(np.uint32).reshape(-1)
sn=np.zeros_like(sp)
sn[:]=[0,0,-1]
u=1-(sp[:,0]-ScrM[:,0].min())/(ScrM[:,0].max()-ScrM[:,0].min()); v=(sp[:,1]-ScrM[:,1].min())/(ScrM[:,1].max()-ScrM[:,1].min())
suv=np.c_[u,v].astype(np.float32)

# ---------- write GLB ----------
def lin(h): c=np.array([int(h[i:i+2],16)/255 for i in (1,3,5)]); return [float(x) for x in np.where(c<=0.04045,c/12.92,((c+0.055)/1.055)**2.4)]+[1.0]
mats=[
 {'name':'casing_rear_light','doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':lin('#d7c8de'),'metallicFactor':0.12,'roughnessFactor':0.42}},
 {'name':'casing_rim_navy','doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':lin('#1d2042'),'metallicFactor':0.2,'roughnessFactor':0.38}},
 {'name':'screen_glass','doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':lin('#04050a'),'metallicFactor':0.0,'roughnessFactor':0.12},'emissiveFactor':[0.0027,0.006,0.024]},
 {'name':'stand_top_light','doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':lin('#cdbfd6'),'metallicFactor':0.12,'roughnessFactor':0.45}},
 {'name':'stand_navy','doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':lin('#1a1c3a'),'metallicFactor':0.25,'roughnessFactor':0.42}},
]
binbuf=bytearray(); bvs=[]; accs=[]; meshes=[]; nodes=[]
def push(arr,target):
    while len(binbuf)%4: binbuf.append(0)
    bvs.append({'buffer':0,'byteOffset':len(binbuf),'byteLength':arr.nbytes,'target':target}); binbuf.extend(arr.tobytes()); return len(bvs)-1
def acc(arr,ctype,typ,target,minmax=False):
    bv=push(arr,target); a={'bufferView':bv,'componentType':ctype,'count':len(arr),'type':typ}
    if minmax: a['min']=[float(x) for x in arr.min(0)]; a['max']=[float(x) for x in arr.max(0)]
    accs.append(a); return len(accs)-1
groups={'Casing':[p for p in prims if p[0].startswith('casing')],'Stand':[p for p in prims if p[0].startswith('stand')]}
for gname,plist in groups.items():
    pl=[]
    for name,p,n,i,mat in plist:
        pl.append({'attributes':{'POSITION':acc(p,5126,'VEC3',34962,True),'NORMAL':acc(n,5126,'VEC3',34962)},'indices':acc(i.reshape(-1,1),5125,'SCALAR',34963),'material':mat,'mode':4,'extras':{'part':name}})
    meshes.append({'name':gname,'primitives':pl}); nodes.append({'name':gname,'mesh':len(meshes)-1})
meshes.append({'name':'Screen','primitives':[{'attributes':{'POSITION':acc(sp,5126,'VEC3',34962,True),'NORMAL':acc(sn,5126,'VEC3',34962),'TEXCOORD_0':acc(suv,5126,'VEC2',34962)},'indices':acc(si.reshape(-1,1),5125,'SCALAR',34963),'material':2,'mode':4}]})
nodes.append({'name':'Screen','mesh':len(meshes)-1})
root={'name':'pc_monitor','children':[0,1,2]}
nodes.append(root)
gl={'asset':{'version':'2.0','generator':'portfolio monitor edit (python, from Sketchfab-14.4.0 export)',
  'extras':{'author':'yuuuusukeeee (https://sketchfab.com/yuuuusukeeee)','license':'CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)','source':'https://sketchfab.com/3d-models/pc-monitor-30ac841584d7432fbca691a2050f3434','title':'PC_monitor',
  'modification':'Geometry modified from the original: casing re-proportioned and slimmed, rear re-sculpted into a four-sided taper, bracket removed and hole closed, stand refitted, materials recoloured.'}},
 'scene':0,'scenes':[{'nodes':[3]}],'nodes':nodes,'meshes':meshes,'materials':mats,'accessors':accs,'bufferViews':bvs,'buffers':[{'byteLength':len(binbuf)}]}
jb=json.dumps(gl,separators=(',',':')).encode(); jb+=b' '*((-len(jb))%4)
while len(binbuf)%4: binbuf.append(0)
total=12+8+len(jb)+8+len(binbuf)
open(OUT,'wb').write(struct.pack('<III',0x46546C67,2,total)+struct.pack('<II',len(jb),0x4E4F534A)+jb+struct.pack('<II',len(binbuf),0x004E4942)+bytes(binbuf))
print('wrote',OUT,total,'bytes')
allp=np.vstack([CasM,ScrM,StM]); print('bbox min',allp.min(0).round(4),'max',allp.max(0).round(4))
# numbers for layout.ts
cas_w=S*Wd; cas_h=S*Hn
panel_y=CLEAR+S*(bb+(Hn-bt-bb)/2); panel_z=FRONT_Z+RIM+RISE-0.0  # panel surface z (rear)
print(json.dumps({'width':cas_w,'height':cas_h,'panel':{'y':panel_y,'z':FRONT_Z+RIM+RISE,'w':S*(Wd-2*bs),'h':S*(Hn-bb-bt)},'rimZ':FRONT_Z+RIM,'neck_top_world':neck_top*S}))
