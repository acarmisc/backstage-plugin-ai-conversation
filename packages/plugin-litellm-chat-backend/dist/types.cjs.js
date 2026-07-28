"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/types.ts
var types_exports = {};
__export(types_exports, {
  CHAT_PERSONA_ANNOTATION_PREFIX: () => CHAT_PERSONA_ANNOTATION_PREFIX,
  CHAT_PERSONA_TYPE: () => CHAT_PERSONA_TYPE
});
module.exports = __toCommonJS(types_exports);
var CHAT_PERSONA_TYPE = "chat-persona";
var CHAT_PERSONA_ANNOTATION_PREFIX = "chat-persona.acarmisc.org";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CHAT_PERSONA_ANNOTATION_PREFIX,
  CHAT_PERSONA_TYPE
});
//# sourceMappingURL=types.cjs.js.map
