/**
 * Convierte literales de cadena de un árbol de mensajes en `string`,
 * para poder tipar copias EN/ES con la misma forma sin unir literales ES.
 */
export type WidenMessageStrings<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends readonly (infer U)[]
        ? readonly WidenMessageStrings<U>[]
        : T extends object
          ? { [K in keyof T]: WidenMessageStrings<T[K]> }
          : T
