import { Schema, type, MapSchema} from '@colyseus/schema';
import  { TeamMember } from './teammember';
export class Team extends Schema {
  @type("string") id: string;          // Unique team ID
  @type("string") name: string;        // Team name
  @type("string") leaderId: string;    // ID of the team leader
  @type({ map: TeamMember }) members = new MapSchema<TeamMember>();
  @type("boolean") flag: boolean;
  
  constructor(id: string, name: string, leaderId: string) {
      super();
      this.id = id;
      this.name = name;
      this.leaderId = leaderId;
      this.flag = true;
  }
  
  addMember(id: string, nickname: string, isLeader: boolean = false): void {
      this.members.set(id, new TeamMember(id, nickname, isLeader));
      this.flag = !this.flag
  }
  
  removeMember(id: string): boolean {
    this.flag = !this.flag
      if (this.members.has(id)) {
          this.members.delete(id);
          
          // If the team is now empty, return true to indicate it should be deleted
          return this.members.size === 0;
      }
      return false;
  }
  
  transferLeadership(newLeaderId: string): boolean {
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