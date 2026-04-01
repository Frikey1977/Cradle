/**
 * LLM 实例数据访问接口 (Repository Pattern)
 */

/**
 * LLM 实例信息
 */
export interface LLMInstanceInfo {
  modelName: string;
  provider: string;
  endpoint?: string;
}

/**
 * LLM 实例数据访问接口
 */
export interface LLMInstanceRepository {
  /**
   * 获取 LLM 实例信息
   * @param instanceId 实例 ID
   */
  getLLMInstanceInfo(instanceId: string): Promise<LLMInstanceInfo | null>;
}

/**
 * 数据库实现的 LLM 实例 Repository
 */
export class DatabaseLLMInstanceRepository implements LLMInstanceRepository {
  constructor(private query: <T>(sql: string, params?: any[]) => Promise<T>) {}

  async getLLMInstanceInfo(instanceId: string): Promise<LLMInstanceInfo | null> {
    try {
      const rows = await this.query<
        {
          sid: string;
          name: string;
          model_name: string;
          provider_name: string;
          base_url?: string;
        }[]
      >(
        `SELECT i.sid, i.name, c.model_name, c.provider_name, c.base_url 
         FROM t_llm_instances i
         JOIN t_llm_configs c ON i.config_id = c.sid
         WHERE i.sid = ? AND i.deleted = 0`,
        [instanceId]
      );

      if (rows.length === 0) {
        console.warn(`[LLMRepository] LLM instance not found: ${instanceId}`);
        return null;
      }

      const instance = rows[0];
      return {
        modelName: instance.model_name,
        provider: instance.provider_name,
        endpoint: instance.base_url,
      };
    } catch (error) {
      console.error(`[LLMRepository] Failed to get LLM instance info:`, error);
      return null;
    }
  }
}
