const { MANGA } = require('@consumet/extensions');

class MangadexProvider {
  constructor() {
    // Create a new instance of MangaDex
    this.client = new MANGA.MangaDex();
  }

  async search(query) {
    try {
      console.log(`Searching MangaDex for: ${query}`);
      // Use the instance method for search
      return await this.client.search(query);
    } catch (error) {
      console.error(`MangaDex search error:`, error);
      throw new Error(`Failed to search manga: ${error.message}`);
    }
  }

  async getMangaInfo(id) {
    try {
      console.log(`Fetching manga info from MangaDex for ID: ${id}`);
      // Use the instance method for fetchMangaInfo
      return await this.client.fetchMangaInfo(id);
    } catch (error) {
      console.error(`MangaDex info error:`, error);
      throw new Error(`Failed to get manga info: ${error.message}`);
    }
  }

  async fetchChapterPages(chapterId) {
    try {
      console.log(`Fetching chapter pages from MangaDex for chapter ID: ${chapterId}`);
      // Use the instance method for fetchChapterPages
      return await this.client.fetchChapterPages(chapterId);
    } catch (error) {
      console.error(`MangaDex chapter pages error:`, error);
      throw new Error(`Failed to fetch chapter pages: ${error.message}`);
    }
  }
}

module.exports = MangadexProvider; 