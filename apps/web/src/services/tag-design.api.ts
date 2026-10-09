import { apiFetch } from './api';
import {
  DEFAULT_TAG_DESIGN,
  type ApiResponse,
  type TagDesignConfig,
  type UpdateTagDesignRequest,
} from '@growfast/shared-types';

/**
 * Service for managing store-level physical tag design configuration.
 * Interacts with backend /store/tag-design endpoints.
 */
export const TagDesignApi = {
  /**
   * Fetch the current active physical tag design for the authenticated user's store.
   * If no custom design has been saved, falls back to DEFAULT_TAG_DESIGN.
   */
  async getDesign(): Promise<TagDesignConfig> {
    try {
      const response = await apiFetch<ApiResponse<TagDesignConfig>>('/store/tag-design');
      if (response && response.data) {
        return response.data;
      }
      return DEFAULT_TAG_DESIGN;
    } catch {
      return DEFAULT_TAG_DESIGN;
    }
  },

  /**
   * Save / update physical tag design for the active store (Requires OWNER role).
   */
  async saveDesign(layout: TagDesignConfig, name?: string): Promise<ApiResponse<TagDesignConfig>> {
    const payload: UpdateTagDesignRequest = {
      name: name || layout.name,
      layout,
    };
    return apiFetch<ApiResponse<TagDesignConfig>>('/store/tag-design', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Reset store tag design back to canonical T2/T3 default (Requires OWNER role).
   */
  async resetDesign(): Promise<ApiResponse<TagDesignConfig>> {
    return apiFetch<ApiResponse<TagDesignConfig>>('/store/tag-design/reset', {
      method: 'POST',
    });
  },
};
