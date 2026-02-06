const format = (str: string, x: any) => `${str} '${x}'`;
const typeStr = (type: string) => format("type", type);
const valueStr = (value: any) => format("value", value);
const instanceStr = (clsName: string) => format("instance of ", clsName);

type Constructor = Function;
type DecoratedMethod = (this: any, ...args: any[]) => any;

interface MethodDecoratorContextLike {
  kind?: string;
  name?: string | symbol;
}

interface RuntimeTypeGuardDecorator {
  (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor | void;
  (value: DecoratedMethod, context: MethodDecoratorContextLike): DecoratedMethod | void;
}

/**
 * Runtime validation decorator supporting both legacy and stage-3 decorators.
 * 
 * Usage without explicit types (logs only):
 *   @RuntimeTypeGuard
 *   async myMethod(arg: string) { ... }
 * 
 * Usage with explicit type validators:
 *   @RuntimeTypeGuard(String, Number)
 *   async myMethod(name: string, count: number) { ... }
 */
export function RuntimeTypeGuard(...expectedConstructors: Constructor[]): RuntimeTypeGuardDecorator;
export function RuntimeTypeGuard(target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor | void;
export function RuntimeTypeGuard(value: DecoratedMethod, context: MethodDecoratorContextLike): DecoratedMethod | void;
export function RuntimeTypeGuard(...args: any[]): RuntimeTypeGuardDecorator | PropertyDescriptor | DecoratedMethod | void {
  if (isLegacyDecoratorInvocation(args)) {
    return createMethodDecorator([])(args[0], args[1], args[2]);
  }

  if (isStage3DecoratorInvocation(args)) {
    return createMethodDecorator([])(args[0], args[1]);
  }

  return createMethodDecorator(args as Constructor[]);
}

function isLegacyDecoratorInvocation(args: any[]): args is [object, string | symbol, PropertyDescriptor] {
  return args.length === 3
     && (typeof args[1] === "string" || typeof args[1] === "symbol") && typeof args[2] === "object" && args[2] !== null;
}

function isStage3DecoratorInvocation(args: any[]): args is [DecoratedMethod, MethodDecoratorContextLike] {
  return args.length === 2 && typeof args[0] === "function" && typeof args[1] === "object" && args[1] !== null
      && (typeof args[1].name === "string" || typeof args[1].name === "symbol" || typeof args[1].kind === "string");
}

function createMethodDecorator(expectedConstructors: Constructor[]): RuntimeTypeGuardDecorator {
  return function (...decoratorArgs: any[]): PropertyDescriptor | DecoratedMethod | void {
    if (isLegacyDecoratorInvocation(decoratorArgs)) {
      const [_target, propertyKey, descriptor] = decoratorArgs;
      return decorateLegacyMethod(descriptor, propertyKey, expectedConstructors);
    }

    if (isStage3DecoratorInvocation(decoratorArgs)) {
      const [targetMethod, context] = decoratorArgs;
      return decorateStage3Method(targetMethod, context, expectedConstructors);
    }

    throw new Error("@RuntimeTypeGuard received an unsupported decorator invocation");
  } as RuntimeTypeGuardDecorator;
}

function decorateLegacyMethod(
  descriptor: PropertyDescriptor, propertyKey: string | symbol, expectedConstructors: Constructor[]
): PropertyDescriptor {
  const targetMethod = descriptor.value;
  if (typeof targetMethod !== "function") {
    throw new Error("@RuntimeTypeGuard can only decorate methods");
  }

  descriptor.value = createReplacementMethod(String(propertyKey), targetMethod, expectedConstructors);
  return descriptor;
}

function decorateStage3Method(
  targetMethod: DecoratedMethod,
  context: MethodDecoratorContextLike,
  expectedConstructors: Constructor[]
): DecoratedMethod {
  if (context?.kind && context.kind !== "method") {
    throw new Error("@RuntimeTypeGuard can only decorate methods");
  }
  if (typeof targetMethod !== "function") {
    throw new Error("@RuntimeTypeGuard can only decorate methods");
  }

  return createReplacementMethod(String(context?.name ?? targetMethod.name ?? "unknown"), targetMethod, expectedConstructors);
}

function createReplacementMethod(
  methodName: string, targetMethod: DecoratedMethod, expectedConstructors: Constructor[]
): DecoratedMethod {
  return function replacementMethod(this: any, ...args: any[]) {
    if (expectedConstructors.length > 0) {
      for (const [paramIndex, ExpectedConstructor] of expectedConstructors.entries()) {
        if (ExpectedConstructor !== Object) {
          const throwError = (strExpected: string, strIncoming: string) => {
            throw new Error(`Method '${methodName}': param #${paramIndex} expected ${strExpected}, got ${strIncoming}`);
          };
          const incomingValue = args[paramIndex];
          if ([String, Number, Boolean].includes(ExpectedConstructor as any)) {
            const expectedType = ExpectedConstructor.name.toLowerCase();
            const incomingType = (incomingValue === null) ? "null" : (typeof incomingValue);
            if (incomingType !== expectedType) {
              throwError(typeStr(expectedType), typeStr(incomingType));
            }
          } else if (!(incomingValue instanceof (ExpectedConstructor as any))) {
            const incomingType = typeof incomingValue;
            const incomingIsObjectOrFunction = ["object", "function"].includes(incomingType);
            const incomingIsNullish = [null, undefined].includes(incomingValue);
            throwError(
              instanceStr((ExpectedConstructor as any).name),
              incomingIsNullish             ? valueStr(incomingValue) :
              incomingIsObjectOrFunction    ? typeStr(incomingType)   : instanceStr(incomingValue.constructor?.name || "Object")
            );
          }
        }
      }
    }
    return targetMethod.apply(this, args);
  };
}