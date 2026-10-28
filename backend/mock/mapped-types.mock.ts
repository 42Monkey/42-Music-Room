// NestJS mapped types help us create new DTOs based on existing ones.
// However, during Jest test, they can cause issues with metadata or slow down the tests.
// Mock that returns the base class directly, avoiding runtime transformations.
// Keeps the tests fast and direct.

export function PartialType(classRef: any) {
  return classRef;
}

export function PickType(classRef: any, keys: any[]) {
  return classRef;
}

export function OmitType(classRef: any, keys: any[]) {
  return classRef;
}

export function IntersectionType(class1: any, class2: any) {
  return class1;
}
