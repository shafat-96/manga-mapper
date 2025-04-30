const { MANGA } = require('@consumet/extensions');

class AsuraScansProvider {
  constructor() {
    this.client = new MANGA.AsuraScans();
  }

  /**
   * Search for manga on AsuraScans
   * @param {string} query - The search query
   * @param {number} page - Optional page number (default: 1)
   * @returns {Promise<Object>} - Search results
   */
  async search(query, page = 1) {
    try {
      console.log(`Searching AsuraScans for: ${query} (page ${page})`);
      const results = await this.client.search(query, page);
      console.log(`Found ${results.results.length} manga results on AsuraScans`);
      return results;
    } catch (error) {
      console.error(`AsuraScans search error:`, error);
      throw new Error(`Failed to search manga on AsuraScans: ${error.message}`);
    }
  }

  /**
   * Get manga details including chapters
   * @param {string} mangaId - The manga ID
   * @returns {Promise<Object>} - The manga details with chapters
   */
  async getMangaInfo(mangaId) {
    try {
      console.log(`Fetching manga info from AsuraScans for ID: ${mangaId}`);
      const mangaInfo = await this.client.fetchMangaInfo(mangaId);
      console.log(`Found ${mangaInfo.chapters.length} chapters for manga: ${mangaInfo.title}`);
      return mangaInfo;
    } catch (error) {
      console.error(`AsuraScans info error:`, error);
      throw new Error(`Failed to get manga info from AsuraScans: ${error.message}`);
    }
  }

  /**
   * Fetch chapter pages from AsuraScans
   * @param {string} chapterId - The chapter ID
   * @returns {Promise<Array>} - Array of pages with image URLs
   */
  async fetchChapterPages(chapterId) {
    try {
      console.log(`Fetching chapter pages from AsuraScans for chapter ID: ${chapterId}`);
      const pages = await this.client.fetchChapterPages(chapterId);
      console.log(`Retrieved ${pages.length} pages for chapter ID: ${chapterId}`);
      return pages;
    } catch (error) {
      console.error(`AsuraScans chapter pages error:`, error);
      throw new Error(`Failed to fetch chapter pages from AsuraScans: ${error.message}`);
    }
  }
}

module.exports = AsuraScansProvider; 