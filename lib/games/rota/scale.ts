/**
 * Rota's world at one scale (3 October 2026): a mill town where one square
 * is 25 metres. Every model is built at its true size divided by 25 (a
 * 4 m car is 0.16 long, a two-storey terrace 0.31 to the ridge), with one
 * exaggeration: the track gauge is widened a little so rails read on a
 * phone. The street, the track and the buildings that grow beside them all
 * come from these numbers, as do the Blender models
 * (docs/concepts/2026-10-03-rota-mill-town/brief.md).
 *
 * Board units: one square is 1, x east, z south, y up, the ground at 0.
 */

export const METRES_PER_SQUARE = 25;

// ---------------------------------------------------------------- streets

/** Half the carriageway: cobbled setts between the kerbs. */
export const CARRIAGE_HALF = 0.15;
/** Half the street to the back of the pavement. */
export const STREET_HALF = 0.2;
/** Cars keep left of the middle by this much (they drive on the right). */
export const LANE = 0.075;
export const ROAD_TOP = 0.012;
export const PAVEMENT_TOP = 0.022;

// ---------------------------------------------------------------- railway

/** Wheel to wheel: the trains' wheels sit at ±0.045. */
export const GAUGE = 0.09;
export const BALLAST_HALF = 0.1;
export const BALLAST_TOP = 0.018;
/** Rail top: a train model's wheels touch 0.038 above its root. */
export const RAIL_TOP = 0.038;
/** Half the width kept clear beside a track for passing wagons. */
export const TRACK_CLEAR = 0.13;

// ---------------------------------------------------------------- junctions

/** An overpass: the road climbs this much over the rail ... */
export const OVERPASS_RISE = 0.13;
/** ... while the rail sinks this much into a brick-walled cutting. */
export const CUTTING_DEPTH = 0.12;
/** Half the cutting's width between its walls. */
export const CUTTING_HALF = 0.125;
/** The fraction of the square the ramps take at each end. */
export const RAMP = 0.37;
/** Half a goods shed's footprint; station stubs stop at its walls. */
export const GOODS_HALF = 0.2;
export const GRAND_HALF = 0.25;

// ---------------------------------------------------------------- buildings

/** One terraced house's frontage and depth. */
export const FRONTAGE = 0.2;
export const HOUSE_DEPTH = 0.26;
/** Lots on a street start this far from its centre line, on a rail this far. */
export const STREET_SETBACK = STREET_HALF + 0.006;
export const TRACK_SETBACK = TRACK_CLEAR + 0.01;
/** A building of height h hides about h / tan(pitch) of ground behind it;
 *  the camera looks down at 49° on wide screens, steeper on phones. */
export const HIDE_PER_HEIGHT = 1 / Math.tan((55 * Math.PI) / 180);
