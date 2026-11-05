// Battle-start effect a unit carries (from an item, or a trait it's a member of): stun enemies
// in a `width` x `depth` area right in front of it (depth Infinity = to the far edge), and
// optionally speed up every ally standing in its column for the rest of the fight.
export interface Opener {
  width: number;
  depth: number;
  stunSeconds: number;
  columnAttackSpeed?: number; // added to attackSpeed; one column's bonus doesn't stack
}
