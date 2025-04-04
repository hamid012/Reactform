"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUniqueId = getUniqueId;
function getUniqueId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
