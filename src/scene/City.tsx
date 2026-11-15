/**
 * The exterior seen through the studio window. The implementation lives in ./city (sky, skyline, streets, traffic,
 * street lamps and trees); this thin wrapper keeps the `City` export that Scene.tsx has always imported.
 */
export { CityEnvironment as City } from './city/CityEnvironment'
