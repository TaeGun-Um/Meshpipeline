// 정적 메시 모듈 배럴.
// 호출부(main.js, controls.js)가 개별 모듈 위치를 몰라도 되게 한 곳에서 재수출한다.
export { LOT, groundHeight, surfaceHeight, createGround, createRoad } from './terrain.js';
export { texMaterial, buildMaterials } from './materials.js';
export { createSky, createLights } from './env.js';
export { createWalls, createHouses, createPoles } from './structures.js';
export { createWeeds } from './scatter.js';
export { createProps } from './props.js';
