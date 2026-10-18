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
   * Reset store tag design back to canonical reference default (Requires OWNER role).
   */
  async resetDesign(): Promise<ApiResponse<TagDesignConfig>> {
    return apiFetch<ApiResponse<TagDesignConfig>>('/store/tag-design/reset', {
      method: 'POST',
    });
  },

  /**
   * Retrieve tag design change audit history (Requires OWNER role).
   */
  async getHistory(): Promise<ApiResponse<any[]>> {
    return apiFetch<ApiResponse<any[]>>('/store/tag-design/history');
  },

  /**
   * Authenticated font download for Code 39 barcode thermal printing.
   */
  async downloadFont(): Promise<void> {
    const token = localStorage.getItem('token');
    const API_URL = import.meta.env.VITE_API_URL || '/api';
    const response = await fetch(`${API_URL}/store/tag-design/download-font`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      throw new Error(`Failed to download font (HTTP ${response.status})`);
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'C39HrP36DmT.ttf';
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
  },
};

