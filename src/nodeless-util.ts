
/**
 * This is useful when switching on (or 'if-elseing') a value and we want a compile-time check
 * that ensures that we considered every possible case.
 *
 * For example:
 * ```
 * enum MyEnum { A, B, C }
 * function fun(v: MyEnum) {
 *      if (v == MyEnum.A) {
 *          return;
 *      } else if (v == MyEnum.B) {
 *          return;
 *      }
 *      guardOfNeverland(v); // Gives an error at compile-time because `MyEnum.C` was not covered.
 * }
 * ```
 */
export function guardOfNeverland(a: never): never {
    return a;
}