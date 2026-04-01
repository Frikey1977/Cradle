/**
 * 画像加载器 (ProfileLoader)
 *
 * 负责从 Repository 加载三类核心画像：
 * 1. 用户画像 (ContactProfile)
 * 2. Agent 画像 (AgentProfile)
 * 3. 关系画像 (RelationshipProfile)
 */

import type {
  ContactProfile,
  AgentProfile,
  RelationshipProfile,
  ScenarioProfile,
  ProfileCollection,
  ProfileLoadParams,
} from "../types/profile.js";
import type { ProfileRepository } from "./repositories/index.js";

/**
 * 画像加载器
 */
export class ProfileLoader {
  constructor(private profileRepo: ProfileRepository) {}

  /**
   * 加载所有画像
   */
  async loadProfiles(params: ProfileLoadParams): Promise<ProfileCollection> {
    console.log(`[ProfileLoader] Loading profiles for agent=${params.agentId}, contact=${params.contactId}`);

    const [contact, agent, relationship, scenario] = await Promise.all([
      this.loadContactProfile(params.contactId),
      this.loadAgentProfile(params.agentId),
      this.loadRelationshipProfile(params.agentId, params.contactId),
      this.loadScenarioProfile(params),
    ]);

    console.log(`[ProfileLoader] Loaded: contact=${!!contact}, agent=${!!agent}, relationship=${!!relationship}, scenario=${!!scenario}`);

    return {
      contact,
      agent,
      relationship,
      scenario,
    };
  }

  /**
   * 加载用户画像
   */
  async loadContactProfile(contactId: string): Promise<ContactProfile | undefined> {
    return this.profileRepo.loadContactProfile(contactId);
  }

  /**
   * 加载 Agent 画像
   */
  async loadAgentProfile(agentId: string): Promise<AgentProfile | undefined> {
    return this.profileRepo.loadAgentProfile(agentId);
  }

  /**
   * 加载关系画像
   */
  async loadRelationshipProfile(
    agentId: string,
    contactId: string
  ): Promise<RelationshipProfile | undefined> {
    return this.profileRepo.loadRelationshipProfile(agentId, contactId);
  }

  /**
   * 加载场景画像
   */
  async loadScenarioProfile(params: ProfileLoadParams): Promise<ScenarioProfile | undefined> {
    return this.profileRepo.loadScenarioProfile(params);
  }
}
