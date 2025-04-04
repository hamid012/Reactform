import { Schema, type} from '@colyseus/schema';
export class TeamMember extends Schema {
  @type("string") id: string;        // Player's ID
  @type("string") nickname: string;  // Player's nickname
  @type("boolean") isLeader: boolean; // Whether this member is the team leader
  @type("boolean") showArrow: boolean; // Whether to show an arrow pointing to this player
  
  constructor(id: string, nickname: string, isLeader: boolean = false) {
      super();
      this.id = id;
      this.nickname = nickname;
      this.isLeader = isLeader;
      this.showArrow = false;
  }
}