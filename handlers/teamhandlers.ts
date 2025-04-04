import { Room } from 'colyseus';
import { GameState } from '../types/gamestate';
import { filterBadWords } from '../utils/textfilters'; // Import the filter function for bad words
import { shorten } from '../utils/textfilters';
import { Team } from '../types/team';
import { getUniqueId } from '../utils/getuniqueid';
import replacmentsData from '../data/replacements.json'; // Load the replacements data from JSON file.
const replacements: { [badWord: string]: string } = replacmentsData

export class TeamHandlers {
    private room: Room<GameState>;
    private state: GameState;
    
    constructor(room: Room<GameState>) {
      this.room = room;
      this.state = room.state;
    }
    handleJoinTeam(client: any, teamId: string): void {
        // Check if player is already in a team
        const player = this.state.players.get(client.sessionId);
        if (!player) return;
        
        if (player.team !== "") {
            // Player is already in a team
            client.send("teamError", { message: "You must leave your current team first" });
            return;
        }
        
        // Check if team exists
        const team = this.state.teams.get(teamId);
        if (!team) {
            client.send("teamError", { message: "Team not found" });
            return;
        }
        
        // Add player to team
        team.addMember(client.sessionId, player.nickname);
        
        // Update player's team affiliation
        player.team = teamId;
        
        // Create a members array for the response
        const members: any = [];
        team.members.forEach(member => {
            members.push({
                id: member.id,
                name: this.state.players.get(member.id)?.nickname || "Unknown",
                isLeader: member.isLeader
            });
        });
        
        // Notify the client
        client.send("teamUpdate", {
            joined: true,
            team: {
                id: teamId,
                name: team.name,
                leaderId: team.leaderId,
                members: members
            }
        });
    }
    handleCreateTeam(client: any, teamName: string): void {
              // Check if player is already in a team
              const player = this.state.players.get(client.sessionId);
              if (!player) return;
              
              if (player.team !== "") {
                  // Player is already in a team
                  client.send("teamError", { message: "You are already in a team" });
                  return;
              }
              
              
              // Validate team name
              if (!teamName || teamName.trim().length < 3 || teamName.trim().length > 20) {
                  client.send("teamError", { message: "Team name must be between 3 and 20 characters" });
                  return;
              }
              
              // Create a new team ID
              const teamId = `team_${getUniqueId()}`;
              
              // Create a new team with the player as leader
              const team = new Team(teamId, shorten(filterBadWords(teamName,replacements),20), client.sessionId);
              team.addMember(client.sessionId, player.nickname, true);
              
              // Add team to state
              this.state.teams.set(teamId, team);
              
              // Update player's team affiliation
              player.team = teamId;
              
              // Notify the client
              client.send("teamUpdate", {
                  accepted: true,
                  team: {
                      id: teamId,
                      name: teamName,
                      leaderId: client.sessionId,
                      members: [{ id: client.sessionId, name: player.nickname, isLeader: true }]
                  }
              });
    }
    handleLeaveTeam(client: any): void {
            const player = this.state.players.get(client.sessionId);
            if (!player || player.team === "") return;
            
            const teamId = player.team;
            const team = this.state.teams.get(teamId);
            if (!team) return;
            
            // If player is the leader and there are other members, transfer leadership
            if (team.leaderId === client.sessionId && team.members.size > 1) {
                // Find another member to be leader
                let newLeaderId: any = null;
                team.members.forEach((member, id) => {
                    if (id !== client.sessionId && !newLeaderId) {
                        newLeaderId = id;
                    }
                });
                
                if (newLeaderId) {
                    team.transferLeadership(newLeaderId);
                }
            }
            
            // Remove player from team
            const shouldDeleteTeam = team.removeMember(client.sessionId);
            
            // Clear player's team affiliation
            player.team = "";
            
            // If team is now empty, delete it
            if (shouldDeleteTeam) {
                this.state.teams.delete(teamId);
            }
            
            // Notify the client
            client.send("teamUpdate", { joined: false });
    }
    handleTransferLeadership(client: any, newLeaderId: string): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || player.team === "") return;
        
        const team = this.state.teams.get(player.team);
        if (!team || team.leaderId !== client.sessionId) {
            // Only the leader can transfer leadership
            client.send("teamError", { message: "Only the team leader can transfer leadership" });
            return;
        }
        
        if (!team.members.has(newLeaderId)) {
            client.send("teamError", { message: "Member not found in team" });
            return;
        }
        
        // Transfer leadership
        team.transferLeadership(newLeaderId);
        
        // No need to notify clients as the state change will propagate automatically
    }
    handleKickMember(client: any, memberId: string): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || player.team === "") return;
        
        const team = this.state.teams.get(player.team);
        if (!team || team.leaderId !== client.sessionId) {
            // Only the leader can kick members
            client.send("teamError", { message: "Only the team leader can kick members" });
            return;
        }
        
        if (memberId === client.sessionId) {
            client.send("teamError", { message: "You cannot kick yourself" });
            return;
        }
        
        if (!team.members.has(memberId)) {
            client.send("teamError", { message: "Member not found in team" });
            return;
        }
        
        // Get the kicked player
        const kickedPlayer = this.state.players.get(memberId);
        if (kickedPlayer) {
            // Clear their team affiliation
            kickedPlayer.team = "";
        }
        
        // Remove member from team
        team.removeMember(memberId);
        
        // Notify the kicked player
        const kickedClient = this.room.clients.find(c => c.sessionId === memberId);
        if (kickedClient) {
            kickedClient.send("teamUpdate", { 
                joined: false,
                kicked: true,
                kickedBy: player.nickname
            });
        }
    }
    handleTeamJoinRequest(client: any, teamId: string): void {
        const requester = this.state.players.get(client.sessionId);
        if (!requester) return;
        
        // Check if player is already in a team
        if (requester.team !== "") {
            client.send("teamError", { message: "You are already in a team" });
            return;
        }
        
        // Check if team exists
        const team = this.state.teams.get(teamId);
        if (!team) {
            client.send("teamError", { message: "Team not found" });
            return;
        }
        
        // Find the team leader
        if (!team.leaderId) {
            client.send("teamError", { message: "Team has no leader" });
            return;
        }
        
        // Try to find the leader's client
        const leaderClient = this.room.clients.find(c => c.sessionId === team.leaderId);
        if (!leaderClient) {
            client.send("teamError", { message: "Team leader is not available" });
            return;
        }
        
        // Send join request to the team leader
        leaderClient.send("teamJoinRequest", {
            playerId: client.sessionId,
            playerName: requester.nickname,
            teamId: teamId
        });
        
        // Let the requester know their request was sent
        client.send("teamError", { message: "Join request sent to team leader" });
    }
    handleTeamJoinResponse(client: any, playerId: string, teamId: string, accepted: boolean, timeout: boolean = false): void {
        // Make sure the responder is actually the team leader
        const responder = this.state.players.get(client.sessionId);
        if (!responder) return;
        
        const team = this.state.teams.get(teamId);
        if (!team || team.leaderId !== client.sessionId) {
            client.send("teamError", { message: "Only the team leader can accept or reject join requests" });
            return;
        }
        
        // Find the player who requested to join
        const requester = this.state.players.get(playerId);
        if (!requester) {
            // Player might have disconnected
            return;
        }
        
        // Check if player is still not in a team
        if (requester.team !== "") {
            // Player already joined a team while request was pending
            return;
        }
        
        // Find the requester's client
        const requesterClient = this.room.clients.find(c => c.sessionId === playerId);
        
        if (accepted) {
            // Add player to team
            team.addMember(playerId, requester.nickname);
            
            // Update player's team affiliation
            requester.team = teamId;
            
            // Notify the requester
            if (requesterClient) {
                // Create a members array for the response
                const members: any = [];
                team.members.forEach((member, id) => {
                    members.push({
                        id: id,
                        name: this.state.players.get(id)?.nickname || "Unknown",
                        isLeader: member.isLeader
                    });
                });
                
                requesterClient.send("teamUpdate", {
                    accepted: true,
                    kicked: false,
                    team: {
                        id: teamId,
                        name: team.name,
                        leaderId: team.leaderId,
                        members: members
                    }
                });
            }
        } else {
            // Notify the requester of rejection
            if (requesterClient) {
                requesterClient.send("teamUpdate", {
                    accepted: false,
                    kicked: false,
                    timeout: timeout
                });
            }
        }
    }
    handleTeamChatMessage(client: any, message: string): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || player.team === "") return;
        
        const team = this.state.teams.get(player.team);
        if (!team) return;
        
        // Send message to all team members
        team.members.forEach((member, memberId) => {
            const memberClient = this.room.clients.find(c => c.sessionId === memberId);
            if (memberClient) {
                memberClient.send("teamChatMessage", {
                    senderId: client.sessionId,
                    sender: player.nickname,
                    message: message
                });
            }
        });
    }
}