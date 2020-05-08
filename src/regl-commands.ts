import REGL from 'regl';

import vertDouble from './shaders/double.vs';
import vertSingle from './shaders/single.vs';
import vertMulti3 from './shaders/multi3.vs';
import vertMulti4 from './shaders/multi4.vs';
import vertMulti5 from './shaders/multi5.vs';
import vertMulti6 from './shaders/multi6.vs';
import vertSmooth from './shaders/smooth.vs';

import fragInterpolateColor from './shaders/interpolateColor.fs';
import fragInterpolateColorOnly from './shaders/interpolateColorOnly.fs';
import fragInterpolateValue from './shaders/interpolateValue.fs';
import fragSingle from './shaders/single.fs';
import fragHsPregen from './shaders/hillshading/hsPregen.fs';
import fragMulti1Calc from './shaders/multiAnalyze1Calc.fs';
import fragMulti1Draw from './shaders/multiAnalyze1Draw.fs';
import fragMulti2Calc from './shaders/multiAnalyze2Calc.fs';
import fragMulti2Draw from './shaders/multiAnalyze2Draw.fs';
import fragMulti3Calc from './shaders/multiAnalyze3Calc.fs';
import fragMulti3Draw from './shaders/multiAnalyze3Draw.fs';
import fragMulti4Calc from './shaders/multiAnalyze4Calc.fs';
import fragMulti4Draw from './shaders/multiAnalyze4Draw.fs';
import fragMulti5Calc from './shaders/multiAnalyze5Calc.fs';
import fragMulti5Draw from './shaders/multiAnalyze5Draw.fs';
import fragMulti6Calc from './shaders/multiAnalyze6Calc.fs';
import fragMulti6Draw from './shaders/multiAnalyze6Draw.fs';
import fragDiffCalc from './shaders/diffCalc.fs';
import fragDiffDraw from './shaders/diffDraw.fs';
import fragConvolutionSmooth from './shaders/convolutionSmooth.fs';

import {
  DEFAULT_COLOR_STOP,
  SCALE_MAX_LENGTH,
  SENTINEL_MAX_LENGTH,
} from './constants';
import {
  DrawCommon,
  DrawTile,
  DrawTileHsSimple,
  DrawTileHsPregen,
  DrawTileInterpolateColor,
  DrawTileInterpolateColorOnly,
  DrawTileInterpolateValue,
  CalcTileMultiAnalyze1,
  DrawTileMultiAnalyze1,
  CalcTileMultiAnalyze2,
  DrawTileMultiAnalyze2,
  CalcTileMultiAnalyze3,
  DrawTileMultiAnalyze3,
  CalcTileMultiAnalyze4,
  DrawTileMultiAnalyze4,
  CalcTileMultiAnalyze5,
  DrawTileMultiAnalyze5,
  CalcTileMultiAnalyze6,
  DrawTileMultiAnalyze6,
  CalcTileDiff,
  DrawTileDiff,
  ConvolutionSmooth,
} from './types';
import * as util from './util';

const littleEndian = util.machineIsLittleEndian();

const bindStructArray = util.bindStructArray.bind(null, ['color', 'offset'], DEFAULT_COLOR_STOP);

const colorScaleUniforms = bindStructArray(SCALE_MAX_LENGTH, 'colorScale');
const sentinelValuesUniforms = bindStructArray(SENTINEL_MAX_LENGTH, 'sentinelValues');

const fragMacros = {
  SCALE_MAX_LENGTH,
  SENTINEL_MAX_LENGTH,
};

/**
 * The object generated by this function should be merged into the DrawConfig for each Regl
 * DrawCommand in the application.
 */
export function getCommonDrawConfiguration(
  tileSize: number,
  nodataValue: number,
): REGL.DrawConfig<DrawCommon.Uniforms, DrawCommon.Attributes, DrawCommon.Props> {
  return {
    uniforms: {
      nodataValue,
      littleEndian,
      transformMatrix: ({ viewportWidth, viewportHeight }) => (
        util.getTransformMatrix(viewportWidth, viewportHeight)
      ),
    },
    attributes: {
      position: (_, { canvasCoordinates }) => {
        const [left, top] = canvasCoordinates;
        const [right, bottom] = [left + tileSize, top + tileSize];
        return [
          [left,  top   ],
          [right, top   ],
          [left,  bottom],
          [right, bottom],
        ];
      },
    },
    // We don't need the depth buffer for 2D drawing. Leaving it enabled (and failing to clear it
    // between draw calls) results in visual artifacts.
    depth: { enable: false },
    primitive: 'triangle strip',
    count: 4,
    viewport: (_, { canvasSize: [width, height] }) => ({ width, height }),
  };
}

// Hillshading (simple) parameters
const deg2rad = 0.017453292519943295;
const slopeFactor = 0.0333334;

/**
 * The resulting Regl DrawCommand is used to draw a single tile. The fragment shader decodes the
 * Float32 value of a pixel and colorizes it with the given color scale (and/or sentinel values).
 */
export function createDrawTileCommand(
  regl: REGL.Regl,
  commonConfig: REGL.DrawConfig<DrawCommon.Uniforms, DrawCommon.Attributes, DrawCommon.Props>,
) {
  return regl<DrawTile.Uniforms, DrawTile.Attributes, DrawTile.Props>({
    ...commonConfig,
    vert: vertSingle,
    frag: util.defineMacros(fragSingle, fragMacros),
    uniforms: {
      ...commonConfig.uniforms as DrawCommon.Uniforms,
      ...colorScaleUniforms,
      ...sentinelValuesUniforms,
      colorScaleLength: (_, { colorScale }) => colorScale.length,
      sentinelValuesLength: (_, { sentinelValues }) => sentinelValues.length,
      texture: (_, { texture }) => texture,
      enableSimpleHillshade: (_, { enableSimpleHillshade }) => enableSimpleHillshade,
      offset: 0,
      azimuth: 0,
      altitude: 0,
      slopescale: 0,
      deg2rad: deg2rad,
      slopeFactor: slopeFactor,
      tileSize: 0,
      textureSize: 0,
      textureBounds: [0, 0, 0, 0],
    },
    attributes: {
      ...commonConfig.attributes as DrawCommon.Attributes,
      texCoord: (_, { textureBounds }) => util.getTexCoordVertices(textureBounds),
    },
  });
}

/**
 * The resulting Regl DrawCommand is used to draw a single tile. The fragment shader decodes the
 * Float32 value of a pixel and colorizes it with the given color scale (and/or sentinel values).
 * Hillshading is applied with a simple and fast algorithm
 */
export function createDrawTileHsSimpleCommand(
  regl: REGL.Regl,
  commonConfig: REGL.DrawConfig<DrawCommon.Uniforms, DrawCommon.Attributes, DrawCommon.Props>,
) {
  return regl<DrawTileHsSimple.Uniforms, DrawTileHsSimple.Attributes, DrawTileHsSimple.Props>({
    ...commonConfig,
    vert: vertSingle,
    frag: util.defineMacros(fragSingle, fragMacros),
    uniforms: {
      ...commonConfig.uniforms as DrawCommon.Uniforms,
      ...colorScaleUniforms,
      ...sentinelValuesUniforms,
      colorScaleLength: (_, { colorScale }) => colorScale.length,
      sentinelValuesLength: (_, { sentinelValues }) => sentinelValues.length,
      texture: (_, { texture }) => texture,
      enableSimpleHillshade: (_, { enableSimpleHillshade }) => enableSimpleHillshade,
      azimuth: (_, { azimuth }) => azimuth,
      altitude: (_, { altitude }) => altitude,
      slopescale: (_, { slopescale }) => slopescale,
      deg2rad: deg2rad,
      slopeFactor: slopeFactor,
      offset: (_, { offset }) => offset,
      textureBounds: (_, { textureBounds }) => {
        return [
          [textureBounds[0].x],
          [textureBounds[0].y],
          [textureBounds[1].x],
          [textureBounds[1].y]
        ]
      },
      textureSize: (_, { textureSize }) => textureSize,
      tileSize: (_, { tileSize }) => tileSize,
      // u_slopescale: 0.5 * slopeFactor,
      // u_azimuthrad: azimuth * deg2rad,
      // u_altituderad: altitude * deg2rad,
    },
    attributes: {
      ...commonConfig.attributes as DrawCommon.Attributes,
      texCoord: (_, { textureBounds }) => util.getTexCoordVertices(textureBounds),
    },
  });
}

/**
 * The resulting Regl DrawCommand is used to draw a single tile. The fragment shader decodes the
 * Float32 value of a pixel and colorizes it with the given color scale (and/or sentinel values).
 * Hillshading is applied from a pre-generated texture
 */
export function createDrawTileHsPregenCommand(
  regl: REGL.Regl,
  commonConfig: REGL.DrawConfig<DrawCommon.Uniforms, DrawCommon.Attributes, DrawCommon.Props>,
) {
  return regl<DrawTileHsPregen.Uniforms, DrawTileHsPregen.Attributes, DrawTileHsPregen.Props>({
    ...commonConfig,
    vert: vertDouble,
    frag: util.defineMacros(fragHsPregen, fragMacros),
    uniforms: {
      ...commonConfig.uniforms as DrawCommon.Uniforms,
      ...colorScaleUniforms,
      ...sentinelValuesUniforms,
      colorScaleLength: (_, { colorScale }) => colorScale.length,
      sentinelValuesLength: (_, { sentinelValues }) => sentinelValues.length,
      texture: (_, { texture }) => texture,
      hillshadePregenTexture: (_, { hillshadePregenTexture }) => hillshadePregenTexture,
    },
    attributes: {
      ...commonConfig.attributes as DrawCommon.Attributes,
      texCoordA: (_, { textureBounds }) => util.getTexCoordVertices(textureBounds),
      texCoordB: (_, { textureBoundsHs }) => util.getTexCoordVertices(textureBoundsHs),
    },
  });
}

/**
 * The DrawCommand output by this function interpolates, for each pixel, between two values, one
 * from `textureA` and one from `textureB`. The same color scale / sentinel values are applied to
 * both.
 */
export function createDrawTileInterpolateValueCommand(
  regl: REGL.Regl,
  commonConfig: REGL.DrawConfig<DrawCommon.Uniforms, DrawCommon.Attributes, DrawCommon.Props>,
) {
  return regl<
    DrawTileInterpolateValue.Uniforms,
    DrawTileInterpolateValue.Attributes,
    DrawTileInterpolateValue.Props
  >({
    ...commonConfig,
    vert: vertDouble,
    frag: util.defineMacros(fragInterpolateValue, fragMacros),
    uniforms: {
      ...commonConfig.uniforms as DrawCommon.Uniforms,
      ...colorScaleUniforms,
      ...sentinelValuesUniforms,
      colorScaleLength: (_, { colorScale }) => colorScale.length,
      sentinelValuesLength: (_, { sentinelValues }) => sentinelValues.length,
      textureA: (_, { textureA }) => textureA,
      textureB: (_, { textureB }) => textureB,
      interpolationFraction: (_, { interpolationFraction }) => interpolationFraction,
    },
    attributes: {
      ...commonConfig.attributes as DrawCommon.Attributes,
      texCoordA: (_, { textureBoundsA }) => util.getTexCoordVertices(textureBoundsA),
      texCoordB: (_, { textureBoundsB }) => util.getTexCoordVertices(textureBoundsB),
    },
  });
}


export function createDrawTileMultiAnalyze1Command(
  regl: REGL.Regl,
  commonConfig: REGL.DrawConfig<DrawCommon.Uniforms, DrawCommon.Attributes, DrawCommon.Props>,
) {
  return regl<
    DrawTileMultiAnalyze1.Uniforms,
    DrawTileMultiAnalyze1.Attributes,
    DrawTileMultiAnalyze1.Props
  >({
    ...commonConfig,
    vert: vertSingle,
    frag: util.defineMacros(fragMulti1Draw, fragMacros),
    depth:  {
      enable: false
    },
    uniforms: {
      ...commonConfig.uniforms as DrawCommon.Uniforms,
      ...colorScaleUniforms,
      ...sentinelValuesUniforms,
      colorScaleLength: (_, { colorScale }) => colorScale.length,
      sentinelValuesLength: (_, { sentinelValues }) => sentinelValues.length,
      filterLowA: (_, { filterLowA }) => filterLowA,
      filterHighA: (_, { filterHighA }) => filterHighA,
      multiplierA: (_, { multiplierA }) => multiplierA,
      textureA: (_, { textureA }) => textureA,
    },
    attributes: {
      ...commonConfig.attributes as DrawCommon.Attributes,
      texCoord: (_, { textureBoundsA }) => util.getTexCoordVertices(textureBoundsA),
    },
  });
}

export function createCalcTileMultiAnalyze1Command(
  regl: REGL.Regl,
  commonConfig: REGL.DrawConfig<DrawCommon.Uniforms, DrawCommon.Attributes, DrawCommon.Props>,
) {
  return regl<
    CalcTileMultiAnalyze1.Uniforms,
    CalcTileMultiAnalyze1.Attributes,
    CalcTileMultiAnalyze1.Props
  >({
    ...commonConfig,
    vert: vertSingle,
    frag: util.defineMacros(fragMulti1Calc, fragMacros),
    depth:  {
      enable: false
    },
    uniforms: {
      ...commonConfig.uniforms as DrawCommon.Uniforms,
      ...colorScaleUniforms,
      ...sentinelValuesUniforms,
      filterLowA: (_, { filterLowA }) => filterLowA,
      filterHighA: (_, { filterHighA }) => filterHighA,
      multiplierA: (_, { multiplierA }) => multiplierA,
      textureA: (_, { textureA }) => textureA,
    },
    attributes: {
      ...commonConfig.attributes as DrawCommon.Attributes,
      texCoord: (_, { textureBoundsA }) => util.getTexCoordVertices(textureBoundsA),
    },
  });
}

export function createDrawTileMultiAnalyze2Command(
  regl: REGL.Regl,
  commonConfig: REGL.DrawConfig<DrawCommon.Uniforms, DrawCommon.Attributes, DrawCommon.Props>,
) {
  return regl<
    DrawTileMultiAnalyze2.Uniforms,
    DrawTileMultiAnalyze2.Attributes,
    DrawTileMultiAnalyze2.Props
  >({
    ...commonConfig,
    vert: vertDouble,
    frag: util.defineMacros(fragMulti2Draw, fragMacros),
    depth:  {
      enable: false
    },
    uniforms: {
      ...commonConfig.uniforms as DrawCommon.Uniforms,
      ...colorScaleUniforms,
      ...sentinelValuesUniforms,
      colorScaleLength: (_, { colorScale }) => colorScale.length,
      sentinelValuesLength: (_, { sentinelValues }) => sentinelValues.length,
      filterLowA: (_, { filterLowA }) => filterLowA,
      filterHighA: (_, { filterHighA }) => filterHighA,
      filterLowB: (_, { filterLowB }) => filterLowB,
      filterHighB: (_, { filterHighB }) => filterHighB,
      multiplierA: (_, { multiplierA }) => multiplierA,
      multiplierB: (_, { multiplierB }) => multiplierB,
      textureA: (_, { textureA }) => textureA,
      textureB: (_, { textureB }) => textureB,
    },
    attributes: {
      ...commonConfig.attributes as DrawCommon.Attributes,
      texCoordA: (_, { textureBoundsA }) => util.getTexCoordVertices(textureBoundsA),
      texCoordB: (_, { textureBoundsB }) => util.getTexCoordVertices(textureBoundsB),
    },
  });
}

export function createCalcTileMultiAnalyze2Command(
  regl: REGL.Regl,
  commonConfig: REGL.DrawConfig<DrawCommon.Uniforms, DrawCommon.Attributes, DrawCommon.Props>,
) {
  return regl<
    CalcTileMultiAnalyze2.Uniforms,
    CalcTileMultiAnalyze2.Attributes,
    CalcTileMultiAnalyze2.Props
  >({
    ...commonConfig,
    vert: vertDouble,
    frag: util.defineMacros(fragMulti2Calc, fragMacros),
    depth:  {
      enable: false
    },
    uniforms: {
      ...commonConfig.uniforms as DrawCommon.Uniforms,
      ...colorScaleUniforms,
      ...sentinelValuesUniforms,
      filterLowA: (_, { filterLowA }) => filterLowA,
      filterHighA: (_, { filterHighA }) => filterHighA,
      filterLowB: (_, { filterLowB }) => filterLowB,
      filterHighB: (_, { filterHighB }) => filterHighB,
      multiplierA: (_, { multiplierA }) => multiplierA,
      multiplierB: (_, { multiplierB }) => multiplierB,
      textureA: (_, { textureA }) => textureA,
      textureB: (_, { textureB }) => textureB,
    },
    attributes: {
      ...commonConfig.attributes as DrawCommon.Attributes,
      texCoordA: (_, { textureBoundsA }) => util.getTexCoordVertices(textureBoundsA),
      texCoordB: (_, { textureBoundsB }) => util.getTexCoordVertices(textureBoundsB),
    },
  });
}

export function createDrawTileMultiAnalyze3Command(
  regl: REGL.Regl,
  commonConfig: REGL.DrawConfig<DrawCommon.Uniforms, DrawCommon.Attributes, DrawCommon.Props>,
) {
  return regl<
    DrawTileMultiAnalyze3.Uniforms,
    DrawTileMultiAnalyze3.Attributes,
    DrawTileMultiAnalyze3.Props
  >({
    ...commonConfig,
    vert: vertMulti3,
    frag: util.defineMacros(fragMulti3Draw, fragMacros),
    depth:  {
      enable: false
    },
    uniforms: {
      ...commonConfig.uniforms as DrawCommon.Uniforms,
      ...colorScaleUniforms,
      ...sentinelValuesUniforms,
      colorScaleLength: (_, { colorScale }) => colorScale.length,
      sentinelValuesLength: (_, { sentinelValues }) => sentinelValues.length,
      filterLowA: (_, { filterLowA }) => filterLowA,
      filterHighA: (_, { filterHighA }) => filterHighA,
      filterLowB: (_, { filterLowB }) => filterLowB,
      filterHighB: (_, { filterHighB }) => filterHighB,
      filterLowC: (_, { filterLowC }) => filterLowC,
      filterHighC: (_, { filterHighC }) => filterHighC,
      multiplierA: (_, { multiplierA }) => multiplierA,
      multiplierB: (_, { multiplierB }) => multiplierB,
      multiplierC: (_, { multiplierC }) => multiplierC,
      textureA: (_, { textureA }) => textureA,
      textureB: (_, { textureB }) => textureB,
      textureC: (_, { textureC }) => textureC,
    },
    attributes: {
      ...commonConfig.attributes as DrawCommon.Attributes,
      texCoordA: (_, { textureBoundsA }) => util.getTexCoordVertices(textureBoundsA),
      texCoordB: (_, { textureBoundsB }) => util.getTexCoordVertices(textureBoundsB),
      texCoordC: (_, { textureBoundsC }) => util.getTexCoordVertices(textureBoundsC),
    },
  });
}

export function createCalcTileMultiAnalyze3Command(
  regl: REGL.Regl,
  commonConfig: REGL.DrawConfig<DrawCommon.Uniforms, DrawCommon.Attributes, DrawCommon.Props>,
) {
  return regl<
    CalcTileMultiAnalyze3.Uniforms,
    CalcTileMultiAnalyze3.Attributes,
    CalcTileMultiAnalyze3.Props
  >({
    ...commonConfig,
    vert: vertMulti3,
    frag: util.defineMacros(fragMulti3Calc, fragMacros),
    depth:  {
      enable: false
    },
    uniforms: {
      ...commonConfig.uniforms as DrawCommon.Uniforms,
      ...colorScaleUniforms,
      ...sentinelValuesUniforms,
      filterLowA: (_, { filterLowA }) => filterLowA,
      filterHighA: (_, { filterHighA }) => filterHighA,
      filterLowB: (_, { filterLowB }) => filterLowB,
      filterHighB: (_, { filterHighB }) => filterHighB,
      filterLowC: (_, { filterLowC }) => filterLowC,
      filterHighC: (_, { filterHighC }) => filterHighC,
      multiplierA: (_, { multiplierA }) => multiplierA,
      multiplierB: (_, { multiplierB }) => multiplierB,
      multiplierC: (_, { multiplierC }) => multiplierC,
      textureA: (_, { textureA }) => textureA,
      textureB: (_, { textureB }) => textureB,
      textureC: (_, { textureC }) => textureC,
    },
    attributes: {
      ...commonConfig.attributes as DrawCommon.Attributes,
      texCoordA: (_, { textureBoundsA }) => util.getTexCoordVertices(textureBoundsA),
      texCoordB: (_, { textureBoundsB }) => util.getTexCoordVertices(textureBoundsB),
      texCoordC: (_, { textureBoundsC }) => util.getTexCoordVertices(textureBoundsC),
    },
  });
}

export function createDrawTileMultiAnalyze4Command(
  regl: REGL.Regl,
  commonConfig: REGL.DrawConfig<DrawCommon.Uniforms, DrawCommon.Attributes, DrawCommon.Props>,
) {
  return regl<
    DrawTileMultiAnalyze4.Uniforms,
    DrawTileMultiAnalyze4.Attributes,
    DrawTileMultiAnalyze4.Props
  >({
    ...commonConfig,
    vert: vertMulti4,
    frag: util.defineMacros(fragMulti4Draw, fragMacros),
    depth:  {
      enable: false
    },
    uniforms: {
      ...commonConfig.uniforms as DrawCommon.Uniforms,
      ...colorScaleUniforms,
      ...sentinelValuesUniforms,
      colorScaleLength: (_, { colorScale }) => colorScale.length,
      sentinelValuesLength: (_, { sentinelValues }) => sentinelValues.length,
      filterLowA: (_, { filterLowA }) => filterLowA,
      filterHighA: (_, { filterHighA }) => filterHighA,
      filterLowB: (_, { filterLowB }) => filterLowB,
      filterHighB: (_, { filterHighB }) => filterHighB,
      filterLowC: (_, { filterLowC }) => filterLowC,
      filterHighC: (_, { filterHighC }) => filterHighC,
      filterLowD: (_, { filterLowD }) => filterLowD,
      filterHighD: (_, { filterHighD }) => filterHighD,
      multiplierA: (_, { multiplierA }) => multiplierA,
      multiplierB: (_, { multiplierB }) => multiplierB,
      multiplierC: (_, { multiplierC }) => multiplierC,
      multiplierD: (_, { multiplierD }) => multiplierD,
      textureA: (_, { textureA }) => textureA,
      textureB: (_, { textureB }) => textureB,
      textureC: (_, { textureC }) => textureC,
      textureD: (_, { textureD }) => textureD,
    },
    attributes: {
      ...commonConfig.attributes as DrawCommon.Attributes,
      texCoordA: (_, { textureBoundsA }) => util.getTexCoordVertices(textureBoundsA),
      texCoordB: (_, { textureBoundsB }) => util.getTexCoordVertices(textureBoundsB),
      texCoordC: (_, { textureBoundsC }) => util.getTexCoordVertices(textureBoundsC),
      texCoordD: (_, { textureBoundsD }) => util.getTexCoordVertices(textureBoundsD),
    },
  });
}

export function createCalcTileMultiAnalyze4Command(
  regl: REGL.Regl,
  commonConfig: REGL.DrawConfig<DrawCommon.Uniforms, DrawCommon.Attributes, DrawCommon.Props>,
) {
  return regl<
    CalcTileMultiAnalyze4.Uniforms,
    CalcTileMultiAnalyze4.Attributes,
    CalcTileMultiAnalyze4.Props
  >({
    ...commonConfig,
    vert: vertMulti4,
    frag: util.defineMacros(fragMulti4Calc, fragMacros),
    depth:  {
      enable: false
    },
    uniforms: {
      ...commonConfig.uniforms as DrawCommon.Uniforms,
      ...colorScaleUniforms,
      ...sentinelValuesUniforms,
      filterLowA: (_, { filterLowA }) => filterLowA,
      filterHighA: (_, { filterHighA }) => filterHighA,
      filterLowB: (_, { filterLowB }) => filterLowB,
      filterHighB: (_, { filterHighB }) => filterHighB,
      filterLowC: (_, { filterLowC }) => filterLowC,
      filterHighC: (_, { filterHighC }) => filterHighC,
      filterLowD: (_, { filterLowD }) => filterLowD,
      filterHighD: (_, { filterHighD }) => filterHighD,
      multiplierA: (_, { multiplierA }) => multiplierA,
      multiplierB: (_, { multiplierB }) => multiplierB,
      multiplierC: (_, { multiplierC }) => multiplierC,
      multiplierD: (_, { multiplierD }) => multiplierD,
      textureA: (_, { textureA }) => textureA,
      textureB: (_, { textureB }) => textureB,
      textureC: (_, { textureC }) => textureC,
      textureD: (_, { textureD }) => textureD,
    },
    attributes: {
      ...commonConfig.attributes as DrawCommon.Attributes,
      texCoordA: (_, { textureBoundsA }) => util.getTexCoordVertices(textureBoundsA),
      texCoordB: (_, { textureBoundsB }) => util.getTexCoordVertices(textureBoundsB),
      texCoordC: (_, { textureBoundsC }) => util.getTexCoordVertices(textureBoundsC),
      texCoordD: (_, { textureBoundsD }) => util.getTexCoordVertices(textureBoundsD),
    },
  });
}

export function createDrawTileMultiAnalyze5Command(
  regl: REGL.Regl,
  commonConfig: REGL.DrawConfig<DrawCommon.Uniforms, DrawCommon.Attributes, DrawCommon.Props>,
) {
  return regl<
    DrawTileMultiAnalyze5.Uniforms,
    DrawTileMultiAnalyze5.Attributes,
    DrawTileMultiAnalyze5.Props
  >({
    ...commonConfig,
    vert: vertMulti5,
    frag: util.defineMacros(fragMulti5Draw, fragMacros),
    depth:  {
      enable: false
    },
    uniforms: {
      ...commonConfig.uniforms as DrawCommon.Uniforms,
      ...colorScaleUniforms,
      ...sentinelValuesUniforms,
      colorScaleLength: (_, { colorScale }) => colorScale.length,
      sentinelValuesLength: (_, { sentinelValues }) => sentinelValues.length,
      filterLowA: (_, { filterLowA }) => filterLowA,
      filterHighA: (_, { filterHighA }) => filterHighA,
      filterLowB: (_, { filterLowB }) => filterLowB,
      filterHighB: (_, { filterHighB }) => filterHighB,
      filterLowC: (_, { filterLowC }) => filterLowC,
      filterHighC: (_, { filterHighC }) => filterHighC,
      filterLowD: (_, { filterLowD }) => filterLowD,
      filterHighD: (_, { filterHighD }) => filterHighD,
      filterLowE: (_, { filterLowE }) => filterLowE,
      filterHighE: (_, { filterHighE }) => filterHighE,
      multiplierA: (_, { multiplierA }) => multiplierA,
      multiplierB: (_, { multiplierB }) => multiplierB,
      multiplierC: (_, { multiplierC }) => multiplierC,
      multiplierD: (_, { multiplierD }) => multiplierD,
      multiplierE: (_, { multiplierE }) => multiplierE,
      textureA: (_, { textureA }) => textureA,
      textureB: (_, { textureB }) => textureB,
      textureC: (_, { textureC }) => textureC,
      textureD: (_, { textureD }) => textureD,
      textureE: (_, { textureE }) => textureE,
    },
    attributes: {
      ...commonConfig.attributes as DrawCommon.Attributes,
      texCoordA: (_, { textureBoundsA }) => util.getTexCoordVertices(textureBoundsA),
      texCoordB: (_, { textureBoundsB }) => util.getTexCoordVertices(textureBoundsB),
      texCoordC: (_, { textureBoundsC }) => util.getTexCoordVertices(textureBoundsC),
      texCoordD: (_, { textureBoundsD }) => util.getTexCoordVertices(textureBoundsD),
      texCoordE: (_, { textureBoundsE }) => util.getTexCoordVertices(textureBoundsE),
    },
  });
}

export function createCalcTileMultiAnalyze5Command(
  regl: REGL.Regl,
  commonConfig: REGL.DrawConfig<DrawCommon.Uniforms, DrawCommon.Attributes, DrawCommon.Props>,
) {
  return regl<
    CalcTileMultiAnalyze5.Uniforms,
    CalcTileMultiAnalyze5.Attributes,
    CalcTileMultiAnalyze5.Props
  >({
    ...commonConfig,
    vert: vertMulti5,
    frag: util.defineMacros(fragMulti5Calc, fragMacros),
    depth:  {
      enable: false
    },
    uniforms: {
      ...commonConfig.uniforms as DrawCommon.Uniforms,
      ...colorScaleUniforms,
      ...sentinelValuesUniforms,
      filterLowA: (_, { filterLowA }) => filterLowA,
      filterHighA: (_, { filterHighA }) => filterHighA,
      filterLowB: (_, { filterLowB }) => filterLowB,
      filterHighB: (_, { filterHighB }) => filterHighB,
      filterLowC: (_, { filterLowC }) => filterLowC,
      filterHighC: (_, { filterHighC }) => filterHighC,
      filterLowD: (_, { filterLowD }) => filterLowD,
      filterHighD: (_, { filterHighD }) => filterHighD,
      filterLowE: (_, { filterLowE }) => filterLowE,
      filterHighE: (_, { filterHighE }) => filterHighE,
      multiplierA: (_, { multiplierA }) => multiplierA,
      multiplierB: (_, { multiplierB }) => multiplierB,
      multiplierC: (_, { multiplierC }) => multiplierC,
      multiplierD: (_, { multiplierD }) => multiplierD,
      multiplierE: (_, { multiplierE }) => multiplierE,
      textureA: (_, { textureA }) => textureA,
      textureB: (_, { textureB }) => textureB,
      textureC: (_, { textureC }) => textureC,
      textureD: (_, { textureD }) => textureD,
      textureE: (_, { textureE }) => textureE,
    },
    attributes: {
      ...commonConfig.attributes as DrawCommon.Attributes,
      texCoordA: (_, { textureBoundsA }) => util.getTexCoordVertices(textureBoundsA),
      texCoordB: (_, { textureBoundsB }) => util.getTexCoordVertices(textureBoundsB),
      texCoordC: (_, { textureBoundsC }) => util.getTexCoordVertices(textureBoundsC),
      texCoordD: (_, { textureBoundsD }) => util.getTexCoordVertices(textureBoundsD),
      texCoordE: (_, { textureBoundsE }) => util.getTexCoordVertices(textureBoundsE),
    },
  });
}


export function createDrawTileMultiAnalyze6Command(
  regl: REGL.Regl,
  commonConfig: REGL.DrawConfig<DrawCommon.Uniforms, DrawCommon.Attributes, DrawCommon.Props>,
) {
  return regl<
    DrawTileMultiAnalyze6.Uniforms,
    DrawTileMultiAnalyze6.Attributes,
    DrawTileMultiAnalyze6.Props
  >({
    ...commonConfig,
    vert: vertMulti6,
    frag: util.defineMacros(fragMulti6Draw, fragMacros),
    depth:  {
      enable: false
    },
    uniforms: {
      ...commonConfig.uniforms as DrawCommon.Uniforms,
      ...colorScaleUniforms,
      ...sentinelValuesUniforms,
      colorScaleLength: (_, { colorScale }) => colorScale.length,
      sentinelValuesLength: (_, { sentinelValues }) => sentinelValues.length,
      filterLowA: (_, { filterLowA }) => filterLowA,
      filterHighA: (_, { filterHighA }) => filterHighA,
      filterLowB: (_, { filterLowB }) => filterLowB,
      filterHighB: (_, { filterHighB }) => filterHighB,
      filterLowC: (_, { filterLowC }) => filterLowC,
      filterHighC: (_, { filterHighC }) => filterHighC,
      filterLowD: (_, { filterLowD }) => filterLowD,
      filterHighD: (_, { filterHighD }) => filterHighD,
      filterLowE: (_, { filterLowE }) => filterLowE,
      filterHighE: (_, { filterHighE }) => filterHighE,
      filterLowF: (_, { filterLowF }) => filterLowF,
      filterHighF: (_, { filterHighF }) => filterHighF,
      multiplierA: (_, { multiplierA }) => multiplierA,
      multiplierB: (_, { multiplierB }) => multiplierB,
      multiplierC: (_, { multiplierC }) => multiplierC,
      multiplierD: (_, { multiplierD }) => multiplierD,
      multiplierE: (_, { multiplierE }) => multiplierE,
      multiplierF: (_, { multiplierF }) => multiplierF,
      textureA: (_, { textureA }) => textureA,
      textureB: (_, { textureB }) => textureB,
      textureC: (_, { textureC }) => textureC,
      textureD: (_, { textureD }) => textureD,
      textureE: (_, { textureE }) => textureE,
      textureF: (_, { textureF }) => textureF,
    },
    attributes: {
      ...commonConfig.attributes as DrawCommon.Attributes,
      texCoordA: (_, { textureBoundsA }) => util.getTexCoordVertices(textureBoundsA),
      texCoordB: (_, { textureBoundsB }) => util.getTexCoordVertices(textureBoundsB),
      texCoordC: (_, { textureBoundsC }) => util.getTexCoordVertices(textureBoundsC),
      texCoordD: (_, { textureBoundsD }) => util.getTexCoordVertices(textureBoundsD),
      texCoordE: (_, { textureBoundsE }) => util.getTexCoordVertices(textureBoundsE),
      texCoordF: (_, { textureBoundsF }) => util.getTexCoordVertices(textureBoundsF)
    },
  });
}

export function createCalcTileMultiAnalyze6Command(
  regl: REGL.Regl,
  commonConfig: REGL.DrawConfig<DrawCommon.Uniforms, DrawCommon.Attributes, DrawCommon.Props>,
) {
  return regl<
    CalcTileMultiAnalyze6.Uniforms,
    CalcTileMultiAnalyze6.Attributes,
    CalcTileMultiAnalyze6.Props
  >({
    ...commonConfig,
    vert: vertMulti6,
    frag: util.defineMacros(fragMulti6Calc, fragMacros),
    depth:  {
      enable: false
    },
    uniforms: {
      ...commonConfig.uniforms as DrawCommon.Uniforms,
      ...colorScaleUniforms,
      ...sentinelValuesUniforms,
      filterLowA: (_, { filterLowA }) => filterLowA,
      filterHighA: (_, { filterHighA }) => filterHighA,
      filterLowB: (_, { filterLowB }) => filterLowB,
      filterHighB: (_, { filterHighB }) => filterHighB,
      filterLowC: (_, { filterLowC }) => filterLowC,
      filterHighC: (_, { filterHighC }) => filterHighC,
      filterLowD: (_, { filterLowD }) => filterLowD,
      filterHighD: (_, { filterHighD }) => filterHighD,
      filterLowE: (_, { filterLowE }) => filterLowE,
      filterHighE: (_, { filterHighE }) => filterHighE,
      filterLowF: (_, { filterLowF }) => filterLowF,
      filterHighF: (_, { filterHighF }) => filterHighF,
      multiplierA: (_, { multiplierA }) => multiplierA,
      multiplierB: (_, { multiplierB }) => multiplierB,
      multiplierC: (_, { multiplierC }) => multiplierC,
      multiplierD: (_, { multiplierD }) => multiplierD,
      multiplierE: (_, { multiplierE }) => multiplierE,
      multiplierF: (_, { multiplierF }) => multiplierF,
      textureA: (_, { textureA }) => textureA,
      textureB: (_, { textureB }) => textureB,
      textureC: (_, { textureC }) => textureC,
      textureD: (_, { textureD }) => textureD,
      textureE: (_, { textureE }) => textureE,
      textureF: (_, { textureF }) => textureF,
    },
    attributes: {
      ...commonConfig.attributes as DrawCommon.Attributes,
      texCoordA: (_, { textureBoundsA }) => util.getTexCoordVertices(textureBoundsA),
      texCoordB: (_, { textureBoundsB }) => util.getTexCoordVertices(textureBoundsB),
      texCoordC: (_, { textureBoundsC }) => util.getTexCoordVertices(textureBoundsC),
      texCoordD: (_, { textureBoundsD }) => util.getTexCoordVertices(textureBoundsD),
      texCoordE: (_, { textureBoundsE }) => util.getTexCoordVertices(textureBoundsE),
      texCoordF: (_, { textureBoundsF }) => util.getTexCoordVertices(textureBoundsF)
    },
  });
}

export function createCalcTileDiffCommand(
  regl: REGL.Regl,
  commonConfig: REGL.DrawConfig<DrawCommon.Uniforms, DrawCommon.Attributes, DrawCommon.Props>,
) {
  return regl<
    CalcTileDiff.Uniforms,
    CalcTileDiff.Attributes,
    CalcTileDiff.Props
  >({
    ...commonConfig,
    vert: vertDouble,
    frag: util.defineMacros(fragDiffCalc, fragMacros),
    depth:  {
      enable: false
    },
    uniforms: {
      ...commonConfig.uniforms as DrawCommon.Uniforms,
      textureA: (_, { textureA }) => textureA,
      textureB: (_, { textureB }) => textureB,
    },
    attributes: {
      ...commonConfig.attributes as DrawCommon.Attributes,
      texCoordA: (_, { textureBoundsA }) => util.getTexCoordVertices(textureBoundsA),
      texCoordB: (_, { textureBoundsB }) => util.getTexCoordVertices(textureBoundsB),
    },
  });
}

export function createDrawTileDiffCommand(
  regl: REGL.Regl,
  commonConfig: REGL.DrawConfig<DrawCommon.Uniforms, DrawCommon.Attributes, DrawCommon.Props>,
) {
  return regl<
    DrawTileDiff.Uniforms,
    DrawTileDiff.Attributes,
    DrawTileDiff.Props
  >({
    ...commonConfig,
    vert: vertDouble,
    frag: util.defineMacros(fragDiffDraw, fragMacros),
    depth:  {
      enable: false
    },
    uniforms: {
      ...commonConfig.uniforms as DrawCommon.Uniforms,
      ...colorScaleUniforms,
      ...sentinelValuesUniforms,
      colorScaleLength: (_, { colorScale }) => colorScale.length,
      sentinelValuesLength: (_, { sentinelValues }) => sentinelValues.length,
      textureA: regl.prop<DrawTileDiff.Props, 'textureA'>("textureA"),
      textureB: regl.prop<DrawTileDiff.Props, 'textureB'>("textureB"),
    },
    attributes: {
      ...commonConfig.attributes as DrawCommon.Attributes,
      texCoordA: (_, { textureBoundsA }) => util.getTexCoordVertices(textureBoundsA),
      texCoordB: (_, { textureBoundsB }) => util.getTexCoordVertices(textureBoundsB),
    },
  });
}

/**
 * The behavior of this DrawCommand is similar to the one above, except that pixels from `textureA`
 * are colorized with one color scale / set of sentinel values, while pixels from `textureB` use a
 * different color scale / set of sentinel values.
 */
export function createDrawTileInterpolateColorCommand(
  regl: REGL.Regl,
  commonConfig: REGL.DrawConfig<DrawCommon.Uniforms, DrawCommon.Attributes, DrawCommon.Props>,
) {
  return regl<
    DrawTileInterpolateColor.Uniforms,
    DrawTileInterpolateColor.Attributes,
    DrawTileInterpolateColor.Props
  >({
    ...commonConfig,
    vert: vertDouble,
    frag: util.defineMacros(fragInterpolateColor, fragMacros),
    uniforms: {
      ...commonConfig.uniforms as DrawCommon.Uniforms,
      ...bindStructArray(SCALE_MAX_LENGTH, 'colorScaleA'),
      ...bindStructArray(SCALE_MAX_LENGTH, 'colorScaleB'),
      ...bindStructArray(SENTINEL_MAX_LENGTH, 'sentinelValuesA'),
      ...bindStructArray(SENTINEL_MAX_LENGTH, 'sentinelValuesB'),
      colorScaleLengthA: (_, { colorScaleA }) => colorScaleA.length,
      colorScaleLengthB: (_, { colorScaleB }) => colorScaleB.length,
      sentinelValuesLengthA: (_, { sentinelValuesA }) => sentinelValuesA.length,
      sentinelValuesLengthB: (_, { sentinelValuesB }) => sentinelValuesB.length,
      textureA: (_, { textureA }) => textureA,
      textureB: (_, { textureB }) => textureB,
      interpolationFraction: (_, { interpolationFraction }) => interpolationFraction,
    },
    attributes: {
      ...commonConfig.attributes as DrawCommon.Attributes,
      texCoordA: (_, { textureBoundsA }) => util.getTexCoordVertices(textureBoundsA),
      texCoordB: (_, { textureBoundsB }) => util.getTexCoordVertices(textureBoundsB),
    },
  });
}

/**
 * The behavior of this DrawCommand is similar to the one above, except that the pixel values
 * are the same. Only the colorscale changes.
 */
export function createDrawTileInterpolateColorOnlyCommand(
  regl: REGL.Regl,
  commonConfig: REGL.DrawConfig<DrawCommon.Uniforms, DrawCommon.Attributes, DrawCommon.Props>,
) {
  return regl<
    DrawTileInterpolateColorOnly.Uniforms,
    DrawTileInterpolateColorOnly.Attributes,
    DrawTileInterpolateColorOnly.Props
  >({
    ...commonConfig,
    vert: vertSingle,
    frag: util.defineMacros(fragInterpolateColorOnly, fragMacros),
    uniforms: {
      ...commonConfig.uniforms as DrawCommon.Uniforms,
      ...bindStructArray(SCALE_MAX_LENGTH, 'colorScaleA'),
      ...bindStructArray(SCALE_MAX_LENGTH, 'colorScaleB'),
      ...bindStructArray(SENTINEL_MAX_LENGTH, 'sentinelValuesA'),
      ...bindStructArray(SENTINEL_MAX_LENGTH, 'sentinelValuesB'),
      colorScaleLengthA: (_, { colorScaleA }) => colorScaleA.length,
      colorScaleLengthB: (_, { colorScaleB }) => colorScaleB.length,
      sentinelValuesLengthA: (_, { sentinelValuesA }) => sentinelValuesA.length,
      sentinelValuesLengthB: (_, { sentinelValuesB }) => sentinelValuesB.length,
      texture: (_, { texture }) => texture,
      interpolationFraction: (_, { interpolationFraction }) => interpolationFraction,
    },
    attributes: {
      ...commonConfig.attributes as DrawCommon.Attributes,
      texCoord: (_, { textureBounds }) => util.getTexCoordVertices(textureBounds),
    },
  });
}

/**
 * The resulting Regl DrawCommand is for using a convolution kernel to smooth the input data.
 * Currently hard-coded the kernel and positions in the shader to reduce number of uniforms.
 */
export function createConvolutionSmoothCommand(
  regl: REGL.Regl,
  commonConfig: REGL.DrawConfig<DrawCommon.Uniforms, DrawCommon.Attributes, DrawCommon.Props>,
) {
  return regl<ConvolutionSmooth.Uniforms, ConvolutionSmooth.Attributes, ConvolutionSmooth.Props>({
    vert: vertSmooth,
    frag: util.defineMacros(fragConvolutionSmooth, fragMacros),
    uniforms: {
      ...commonConfig.uniforms as DrawCommon.Uniforms,
      texture: regl.prop<ConvolutionSmooth.Props, 'texture'>("texture"),
      textureSize: regl.prop<ConvolutionSmooth.Props, 'textureSize'>("textureSize"),
      kernelSize: regl.prop<ConvolutionSmooth.Props, 'kernelSize'>("kernelSize"),
    },
    attributes: {
      texCoord: [0, 1, 1, 1, 0, 0, 1, 0],
      position: [-1, 1, 1, 1, -1, -1, 1, -1],
    },
    depth: { enable: false },
    primitive: 'triangle strip',
    count: 4,
  });
}