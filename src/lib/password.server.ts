import { hash, type Options, verify } from "@node-rs/argon2";

const ARGON2ID_OPTIONS: Options = {
  // @node-rs/argon2 exposes Algorithm as a const enum, which is incompatible
  // with this project's isolatedModules setting. Value 2 is Argon2id.
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(password: string) {
  return hash(password, ARGON2ID_OPTIONS);
}

export function verifyPassword(hashValue: string, password: string) {
  return verify(hashValue, password, ARGON2ID_OPTIONS);
}
