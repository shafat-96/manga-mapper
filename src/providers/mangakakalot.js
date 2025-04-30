const axios = require('axios');
const cheerio = require('cheerio');

class MangaKakalotProvider {
  constructor() {
    this.baseUrl = 'https://www.mangakakalot.gg';
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': 'https://www.mangakakalot.gg/',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5'
    };
  }

  /**
   * Transform title into URL-friendly format with underscores
   * @param {string} title - The manga title
   * @returns {string} - URL-friendly title
   */
  makeUrlFriendly(title) {
    if (!title) return '';
    
    // Remove parentheses and their contents, like (2022) or (Remake)
    let friendly = title.replace(/\s*\([^)]*\)\s*/g, ' ');
    
    // Remove special characters and replace spaces with underscores
    friendly = friendly
      .toLowerCase()
      .replace(/['":,!?]/g, '') // Remove common punctuation
      .replace(/\s+/g, '_')     // Replace spaces with underscores
      .replace(/-+/g, '_')      // Replace hyphens with underscores
      .replace(/[^\w_]/g, '')   // Remove any other non-alphanumeric characters except underscores
      .replace(/_+/g, '_')      // Replace multiple underscores with a single one
      .trim();
    
    return friendly;
  }

  /**
   * Search for manga on MangaKakalot
   * @param {string} query - The search term
   * @param {number} page - Page number for pagination (default: 1)
   * @returns {Promise<Object>} - Search results
   */
  async search(query, page = 1) {
    try {
      // Try both regular search and URL-friendly search
      const searchQueries = [
        // Original query
        encodeURIComponent(query),
        // URL-friendly version with underscores
        this.makeUrlFriendly(query)
      ];
      
      let results = [];
      let pagination = null;
      
      // Try each search query until we get results
      for (const searchQuery of searchQueries) {
        if (!searchQuery) continue;
        
        const searchUrl = `${this.baseUrl}/search/story/${searchQuery}${page > 1 ? '?page=' + page : ''}`;
        
        try {
          const { data } = await axios.get(searchUrl, { headers: this.headers });
          const $ = cheerio.load(data);
          
          const currentResults = [];
          
          // Extract manga items from search results
          $('.panel_story_list .story_item').each((i, el) => {
            const title = $(el).find('.story_name a').text().trim();
            const url = $(el).find('.story_name a').attr('href');
            const id = url ? url.split('/manga/')[1] : '';
            const image = $(el).find('img').attr('src');
            
            // Extract chapters
            const chapters = [];
            $(el).find('.story_chapter a').each((i, chapterEl) => {
              const chapterName = $(chapterEl).text().trim();
              const chapterUrl = $(chapterEl).attr('href');
              const chapterId = chapterUrl ? chapterUrl.split('/').pop() : '';
              
              chapters.push({
                id: chapterId,
                name: chapterName
              });
            });
            
            // Extract author, updated date, and views
            const authorText = $(el).find('.story_item_right span:contains("Author")').text().trim();
            const author = authorText.replace('Author(s) :', '').trim();
            
            const updatedText = $(el).find('.story_item_right span:contains("Updated")').text().trim();
            const updated = updatedText.replace('Updated :', '').trim();
            
            const viewsText = $(el).find('.story_item_right span:contains("View")').text().trim();
            const views = viewsText.replace('View :', '').trim();
            
            currentResults.push({
              id,
              title,
              image,
              latestChapters: chapters,
              author,
              updated,
              views: views.replace(/,/g, '') || 0
            });
          });
          
          // If we have results, stop trying more search queries
          if (currentResults.length > 0) {
            results = currentResults;
            
            // Extract pagination info
            const currentPage = parseInt($('.panel_page_number .page_select').text().trim()) || page;
            const hasNextPage = $('.panel_page_number .page_last').length > 0 && 
                                !$('.panel_page_number .page_last').hasClass('page_blue');
            
            let totalPages = 1;
            const lastPageText = $('.panel_page_number .page_last').text().trim();
            const totalPagesMatch = lastPageText.match(/Last\((\d+)\)/);
            if (totalPagesMatch && totalPagesMatch[1]) {
              totalPages = parseInt(totalPagesMatch[1]);
            }
            
            // Extract total manga count
            let totalMangas = 0;
            const totalMangasText = $('.panel_page_number .group_qty .page_blue').text().trim();
            const totalMangasMatch = totalMangasText.match(/Total: (\d+) stories/);
            if (totalMangasMatch && totalMangasMatch[1]) {
              totalMangas = parseInt(totalMangasMatch[1]);
            }
            
            pagination = {
              currentPage,
              hasNextPage,
              totalPages,
              totalMangas
            };
            
            break; // Stop trying more search queries
          }
        } catch (error) {
          // Continue to the next search query if there's an error
          continue;
        }
      }
      
      // If we didn't find any results with any search query, return empty results
      if (!pagination) {
        pagination = {
          currentPage: page,
          hasNextPage: false,
          totalPages: 0,
          totalMangas: 0
        };
      }
      
      return {
        results: results,
        pagination: pagination
      };
    } catch (error) {
      throw new Error(`Failed to search manga on MangaKakalot: ${error.message}`);
    }
  }

  /**
   * Get manga information including chapters
   * @param {string} mangaId - The manga ID or slug
   * @returns {Promise<Object>} - Manga information with chapters
   */
  async getMangaInfo(mangaId) {
    try {
      const mangaUrl = `${this.baseUrl}/manga/${mangaId}`;
      
      const { data } = await axios.get(mangaUrl, { headers: this.headers });
      const $ = cheerio.load(data);
      
      // Extract basic manga info
      const title = $('.manga-info-text h1').text().trim();
      const image = $('.manga-info-pic img').attr('src');
      
      // Extract alternative titles
      const altTitles = $('.manga-info-text .story-alternative').text().replace('Alternative :', '').trim();
      
      // Extract author and status
      const authorText = $('.manga-info-text li:contains("Author")').text().trim();
      const author = authorText.replace('Author(s) :', '').trim();
      
      const statusText = $('.manga-info-text li:contains("Status")').text().trim();
      const status = statusText.replace('Status :', '').trim();
      
      // Extract genres
      const genres = [];
      $('.manga-info-text li.genres a').each((i, el) => {
        genres.push($(el).text().trim());
      });
      
      // Extract description
      const description = $('#contentBox').text().trim();
      
      // Extract chapters
      const chapters = [];
      $('.chapter-list .row').each((i, el) => {
        const chapterLink = $(el).find('span:first-child a');
        const chapterName = chapterLink.text().trim();
        const chapterUrl = chapterLink.attr('href');
        const chapterId = chapterUrl ? chapterUrl.split('/').pop() : '';
        const date = $(el).find('span:last-child').text().trim();
        const views = $(el).find('span:nth-child(2)').text().trim();
        
        chapters.push({
          id: chapterId,
          title: chapterName,
          date,
          views: parseInt(views) || 0
        });
      });
      
      return {
        id: mangaId,
        title,
        altTitles,
        image,
        author,
        status,
        genres,
        description,
        chapters
      };
    } catch (error) {
      throw new Error(`Failed to get manga info from MangaKakalot: ${error.message}`);
    }
  }

  /**
   * Fetch chapter pages/images from MangaKakalot
   * @param {string} chapterId - The chapter ID (can be full path)
   * @returns {Promise<Array>} - Array of pages with image URLs
   */
  async fetchChapterPages(chapterId) {
    try {
      // Parse the chapterId to handle various formats
      let mangaId = '';
      let chapterPath = chapterId;
      
      // If it's a full URL, extract the path
      if (chapterId.startsWith('http')) {
        const url = new URL(chapterId);
        chapterPath = url.pathname.substring(1); // Remove leading slash
      }
      
      // If it contains a slash, it might be in "mangaId/chapterId" format
      if (chapterPath.includes('/')) {
        const parts = chapterPath.split('/');
        if (parts.length >= 2) {
          mangaId = parts[0];
          chapterPath = parts.slice(1).join('/');
        }
      }
      
      // Construct the URL based on what we have
      const chapterUrl = mangaId 
        ? `${this.baseUrl}/manga/${mangaId}/${chapterPath}`
        : `${this.baseUrl}/${chapterPath}`;
      
      // Fetch chapter page HTML
      const { data } = await axios.get(chapterUrl, { headers: this.headers });
      const $ = cheerio.load(data);
      
      // Set to store unique image URLs to avoid duplicates
      const uniqueUrls = new Set();
      
      // Method 1: Extract images from the container-chapter-reader - primary method
      $('.container-chapter-reader img').each((i, el) => {
        const imageUrl = $(el).attr('src') || $(el).attr('data-src');
        if (imageUrl && 
            !imageUrl.includes('thumb.') && 
            !imageUrl.includes('logo') && 
            !imageUrl.includes('icon')) {
          uniqueUrls.add(imageUrl);
        }
      });
      
      // Method 2: Look for specific image patterns in the HTML
      if (uniqueUrls.size === 0) {
        // Find image URLs in the HTML source - this is a fallback method
        const imgRegex = /https?:\/\/[^"'\s)]+\.(?:jpg|jpeg|png|webp)(?:[?][^"'\s)]*)?/gi;
        const imgMatches = Array.from(data.matchAll(imgRegex));
        
        for (const match of imgMatches) {
          const imgUrl = match[0];
          if (imgUrl && 
              !imgUrl.includes('thumb.') && 
              !imgUrl.includes('logo') && 
              !imgUrl.includes('icon') &&
              !imgUrl.includes('avatars') &&
              !uniqueUrls.has(imgUrl)) {
            uniqueUrls.add(imgUrl);
          }
        }
      }
      
      // Method 3: Try to extract image URLs from JavaScript variables
      if (uniqueUrls.size === 0) {
        // Look for various patterns of JavaScript image arrays in script tags
        const scripts = $('script').map((i, el) => $(el).html()).get();
        
        for (const script of scripts) {
          // Try to find array patterns like chapter_images = [...], imagesArray = [...], etc.
          const arrayPatterns = [
            /var\s+chapter_images\s*=\s*(\[.+?\])\s*;/s,
            /var\s+images\s*=\s*(\[.+?\])\s*;/s,
            /var\s+imagesArray\s*=\s*(\[.+?\])\s*;/s,
            /var\s+pages\s*=\s*(\[.+?\])\s*;/s,
            /\"pages\"\s*:\s*(\[.+?\])/s,
            /\"images\"\s*:\s*(\[.+?\])/s
          ];
          
          for (const pattern of arrayPatterns) {
            const match = script.match(pattern);
            if (match && match[1]) {
              try {
                // Try to parse the array
                const images = JSON.parse(match[1]);
                if (Array.isArray(images)) {
                  for (const img of images) {
                    // Handle both string URLs and objects with image URLs
                    const imgUrl = typeof img === 'string' 
                      ? img 
                      : (img.url || img.src || img.path || img.img || '');
                    
                    if (imgUrl && !uniqueUrls.has(imgUrl)) {
                      uniqueUrls.add(imgUrl);
                    }
                  }
                }
                
                // If we found images, no need to continue with other patterns
                if (uniqueUrls.size > 0) break;
              } catch (e) {
                // Error parsing image array from script
              }
            }
          }
        }
      }
      
      // Convert the unique URLs set back to an array with index
      const pages = Array.from(uniqueUrls)
        .filter(url => {
          // Filter out any non-image URLs or unwanted images
          return url.match(/\.(jpg|jpeg|png|webp)(\?.*)?$/i) && 
                 !url.includes('avatar') &&
                 !url.includes('logo') &&
                 !url.includes('banner');
        })
        .map((url, index) => ({
          url,
          index: index + 1
        }));
      
      // Sort pages by index to ensure correct order
      pages.sort((a, b) => a.index - b.index);
      
      return pages;
    } catch (error) {
      throw new Error(`Failed to fetch chapter pages from MangaKakalot: ${error.message}`);
    }
  }
}

module.exports = MangaKakalotProvider; 