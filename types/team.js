"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Team = void 0;
const schema_1 = require("@colyseus/schema");
const teammember_1 = require("./teammember");
class Team extends schema_1.Schema {
    constructor(id, name, leaderId) {
        super();
        this.members = new schema_1.MapSchema();
        this.id = id;
        this.name = name;
        this.leaderId = leaderId;
        this.flag = true;
    }
    addMember(id, nickname, isLeader = false) {
        this.members.set(id, new teammember_1.TeamMember(id, nickname, isLeader));
        this.flag = !this.flag;
    }
    removeMember(id) {
        this.flag = !this.flag;
        if (this.members.has(id)) {
            this.members.delete(id);
            // If the team is now empty, return true to indicate it should be deleted
            return this.members.size === 0;
        }
        return false;
    }
    transferLeadership(newLeaderId) {
        if (this.members.has(newLeaderId)) {
            const oldLeaderId = this.leaderId;
            // Update the leader ID
            this.leaderId = newLeaderId;
            // Update the isLeader flags for members
            const oldLeader = this.members.get(oldLeaderId);
            if (oldLeader) {
                oldLeader.isLeader = false;
            }
            const newLeader = this.members.get(newLeaderId);
            if (newLeader) {
                newLeader.isLeader = true;
            }
            return true;
        }
        return false;
    }
}
exports.Team = Team;
__decorate([
    (0, schema_1.type)("string")
], Team.prototype, "id", void 0);
__decorate([
    (0, schema_1.type)("string")
], Team.prototype, "name", void 0);
__decorate([
    (0, schema_1.type)("string")
], Team.prototype, "leaderId", void 0);
__decorate([
    (0, schema_1.type)({ map: teammember_1.TeamMember })
], Team.prototype, "members", void 0);
__decorate([
    (0, schema_1.type)("boolean")
], Team.prototype, "flag", void 0);
