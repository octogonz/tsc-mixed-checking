import { nonstrictFunction } from "./b-weak-typescript";

export function test(): void {
  // TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.
  nonstrictFunction(123);
}
