import REGL from 'regl';

import vertSingle from '../shaders/vertex/single.vs';

import fragConvertDem from '../shaders/fragment/convertDem.fs';

import {
	DrawCommon,
	ConvertDem
} from '../types';

import * as util from '../util';

const littleEndian = util.machineIsLittleEndian();

/**
 * The object generated by this function should be merged into the DrawConfig for each Regl
 * command in the application.
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

/**
 * The command output by this function converts a tile in DEM format
 * to float32 packed as rgba.
 */
export function createConvertDemCommand(
	regl: REGL.Regl,
	commonConfig: REGL.DrawConfig<DrawCommon.Uniforms, DrawCommon.Attributes, DrawCommon.Props>,
) {
	return regl<
	  ConvertDem.Uniforms,
	  ConvertDem.Attributes,
	  ConvertDem.Props
	>({
	  ...commonConfig,
	  vert: vertSingle,
	  frag: fragConvertDem,
	  depth:  {
		enable: false
	  },
	  uniforms: {
		...commonConfig.uniforms as DrawCommon.Uniforms,
		texture: (_, { texture }) => texture,
	  },
	  attributes: {
		...commonConfig.attributes as DrawCommon.Attributes,
		texCoord: [[0, 1], [1, 1], [0, 0], [1, 0]],
	  },
	  framebuffer: regl.prop<ConvertDem.Props, 'fbo'>("fbo"),
	});
}