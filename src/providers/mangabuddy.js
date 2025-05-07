const fetch = require('node-fetch');
const cheerio = require('cheerio');

class MangaBuddyProvider {
  constructor() {
    this.baseUrl = 'https://mangabuddy.com';
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  }

  /**
   * Fetch HTML content from a URL
   * @param {string} url - The URL to fetch
   * @returns {Promise<string>} - HTML content
   */
  async fetchHtml(url) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
      throw error;
    }
  }

  /**
   * Search for manga
   * @param {string} query - The search term
   * @returns {Promise<Object>} - Search results
   */
  async search(query) {
    try {
      // If query already contains plus signs, don't encode them again
      const formattedQuery = query.includes('+') ? query : encodeURIComponent(query);
      const searchUrl = `${this.baseUrl}/search?q=${formattedQuery}`;
      
      console.log(`Searching MangaBuddy for: ${query}`);
      
      const html = await this.fetchHtml(searchUrl);
      const $ = cheerio.load(html);
      
      const results = [];
      
      // Extract manga items from search results
      $('.book-item').each((index, element) => {
        const $element = $(element);
        const linkElement = $element.find('a');
        
        if (linkElement.length > 0) {
          const href = linkElement.attr('href');
          const title = linkElement.attr('title') || linkElement.find('img').attr('alt') || '';
          const image = linkElement.find('img').attr('src') || '';
          
          // Extract manga ID from the URL
          const mangaId = href.split('/').pop();
          
          // Extract genres
          const genres = [];
          $element.find('.genres span').each((i, genreElement) => {
            genres.push($(genreElement).text().trim());
          });
          
          // Extract latest chapter if available
          const latestChapter = $element.find('.latest-chapter').text().trim();
          
          results.push({
            id: mangaId,
            title: title.trim(),
            image: image,
            url: this.baseUrl + href,
            genres: genres,
            latestChapter: latestChapter
          });
        }
      });
      
      return {
        results: results
      };
    } catch (error) {
      console.error('Search error:', error);
      throw new Error(`Failed to search for manga: ${error.message}`);
    }
  }

  /**
   * Get manga information including chapters
   * @param {string} mangaId - The manga ID or slug
   * @returns {Promise<Object>} - Manga information with chapters
   */
  async getMangaInfo(mangaId) {
    try {
      console.log(`Getting manga info for: ${mangaId}`);
      const startTime = Date.now();
      const mangaUrl = `${this.baseUrl}/${mangaId}`;
      
      const html = await this.fetchHtml(mangaUrl);
      console.log(`Fetch completed in ${Date.now() - startTime}ms`);
      
      // OPTIMIZATION: Only load cheerio once and use it for everything
      const $ = cheerio.load(html);
      console.log(`Cheerio loaded in ${Date.now() - startTime}ms`);
      
      // OPTIMIZATION: Batch basic info extraction
      const title = $('.book-info .detail .name').text().trim();
      const image = $('.book-info .cover img').attr('src') || '';
      const description = $('.book-info .summary .content').text().trim();
      const status = $('.book-info .detail .meta-item:contains("Status:") span').text().trim();
      const author = $('.book-info .detail .meta-item:contains("Author:") span').text().trim();
      const rating = $('.book-info .detail .rating strong').text().trim();
      
      // Extract genres in one pass
      const genres = [];
      $('.book-info .detail .meta-item:contains("Genres:") span a').each((i, element) => {
        genres.push($(element).text().trim());
      });
      
      console.log(`Basic info extracted in ${Date.now() - startTime}ms`);
      
      // ULTRA-FAST: Use regex directly on HTML to find latest chapter number
      let latestChapter = 1;
      
      // Method 1: Try to extract from chapter count in header using regex
      const chapterCountMatch = html.match(/CHAPTERS\s*\((\d+)\)/i);
      if (chapterCountMatch && chapterCountMatch[1]) {
        latestChapter = parseInt(chapterCountMatch[1], 10);
        console.log(`Using chapter count from header: ${latestChapter}`);
      } else {
        // Method 2: Look for highest chapter in href using regex
        const chapterMatches = Array.from(html.matchAll(/href="\/[^"]+\/chapter-(\d+)"/g));
        for (const match of chapterMatches) {
          if (match[1]) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > latestChapter) {
              latestChapter = num;
            }
          }
        }
        console.log(`Found highest chapter from links: ${latestChapter}`);
      }
      
      console.log(`Latest chapter (${latestChapter}) found in ${Date.now() - startTime}ms`);
      
      // OPTIMIZATION: Use faster chapter generation with array pre-allocation
      // Pre-allocate array for better performance with large chapter counts
      const chaptersCount = latestChapter;
      const chapters = new Array(chaptersCount);
      
      // Generate all chapters in one optimized loop (newest first)
      const urlPrefix = `${this.baseUrl}/${mangaId}/chapter-`;
      for (let i = 0; i < chaptersCount; i++) {
        const chapterNum = latestChapter - i;
        chapters[i] = {
          id: `chapter-${chapterNum}`,
          title: `Chapter ${chapterNum}`,
          number: String(chapterNum),
          url: urlPrefix + chapterNum,
          date: chapterNum === latestChapter ? 'Recent' : 'Unknown'
        };
      }
      
      const endTime = Date.now();
      console.log(`Generated ${chapters.length} chapters in ${endTime - startTime}ms`);
      
      // Return the final manga info
      return {
        id: mangaId,
        title: title,
        image: image,
        description: description,
        genres: genres,
        status: status,
        author: author,
        rating: rating,
        chapters: chapters
      };
    } catch (error) {
      console.error('Get manga info error:', error);
      throw new Error(`Failed to get manga info: ${error.message}`);
    }
  }
  
  /**
   * Get chapter images
   * @param {string} mangaId - The manga ID or slug
   * @param {string} chapterId - The chapter ID or slug
   * @returns {Promise<Object>} - Chapter images
   */
  async getChapterImages(mangaId, chapterId) {
    try {
      console.log(`Getting chapter images for manga: ${mangaId}, chapter: ${chapterId}`);
      const chapterUrl = `${this.baseUrl}/${mangaId}/${chapterId}`;
      
      const html = await this.fetchHtml(chapterUrl);
      const $ = cheerio.load(html);
      
      // Extract chapter title
      const chapterTitle = $('.chapter-heading h1').text().trim();
      
      // Extract images
      const images = [];
      $('.chapter-images img').each((i, element) => {
        const $element = $(element);
        const src = $element.attr('data-src') || $element.attr('src') || '';
        
        if (src) {
          images.push({
            url: src,
            index: i + 1
          });
        }
      });
      
      return {
        mangaId: mangaId,
        chapterId: chapterId,
        title: chapterTitle,
        images: images
      };
    } catch (error) {
      console.error('Get chapter images error:', error);
      throw new Error(`Failed to get chapter images: ${error.message}`);
    }
  }
  
  /**
   * Fetch chapter pages from MangaBuddy
   * @param {string} chapterId - The chapter ID (can be full path)
   * @returns {Promise<Array>} - Array of pages with image URLs
   */
  async fetchChapterPages(chapterId) {
    try {
      console.log(`Fetching chapter pages from MangaBuddy for chapter ID: ${chapterId}`);
      
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
        ? `${this.baseUrl}/${mangaId}/${chapterPath}`
        : `${this.baseUrl}/${chapterPath}`;
      
      console.log(`Requesting URL: ${chapterUrl}`);
      
      // Fetch chapter page HTML
      const htmlContent = await this.fetchHtml(chapterUrl);
      
      // Use a Set to store unique URLs and avoid duplicates
      const uniqueUrls = new Set();
      
      // Method 1: Look for a comma-separated list of image URLs (MangaBuddy sometimes does this)
      const commaListRegex = /https?:\/\/[^"'\s)]+\.(?:jpg|jpeg|png|webp)(?:,[^"'\s)]+\.(?:jpg|jpeg|png|webp))+/gi;
      const commaListMatches = Array.from(htmlContent.matchAll(commaListRegex));
      
      if (commaListMatches.length > 0) {
        console.log(`Found ${commaListMatches.length} comma-separated lists of images`);
        
        for (const match of commaListMatches) {
          // Split the comma-separated list into individual URLs
          const urls = match[0].split(',');
          console.log(`Split list into ${urls.length} individual URLs`);
          
          for (const url of urls) {
            if (url && url.trim() && 
                !url.includes('avatar') && 
                !url.includes('icon') && 
                !url.includes('thumb.') && 
                !uniqueUrls.has(url.trim())) {
              uniqueUrls.add(url.trim());
            }
          }
        }
      }
      
      // Method 2: Look for chapter-lazy-image with data-src attribute (main method for MangaBuddy)
      const $ = cheerio.load(htmlContent);
      $('.chapter-lazy-image, .chapter-images img, .chapter-image').each((i, element) => {
        const $element = $(element);
        const src = $element.attr('data-src') || $element.attr('src') || '';
        
        if (src && !src.includes('/static/common/x.gif') && 
            !src.includes('thumb.') && 
            !src.includes('thumbnail.')) {
          
          // Check if the src contains a comma, which might indicate a list of URLs
          if (src.includes(',')) {
            // Split and add each URL individually
            const urls = src.split(',');
            for (const url of urls) {
              if (url && url.trim() && !uniqueUrls.has(url.trim())) {
                uniqueUrls.add(url.trim());
              }
            }
          } else {
            // Single URL
            if (!uniqueUrls.has(src)) {
              uniqueUrls.add(src);
            }
          }
        }
      });
      
      // Method 3: Check for specific image domains used by MangaBuddy
      if (uniqueUrls.size === 0) {
        const mbDomainRegex = /https?:\/\/(?:[a-z0-9-]+\.)?mbcdn[a-z0-9]*\.(?:org|com)\/res\/manga\/[^"'\s)]+\.(?:jpg|jpeg|png|webp|gif)/gi;
        const mbDomainMatches = Array.from(htmlContent.matchAll(mbDomainRegex));
        
        if (mbDomainMatches.length > 0) {
          console.log(`Found ${mbDomainMatches.length} images from MangaBuddy domains`);
          
          for (const match of mbDomainMatches) {
            const imageUrl = match[0];
            if (imageUrl && !uniqueUrls.has(imageUrl)) {
              uniqueUrls.add(imageUrl);
            }
          }
        }
      }
      
      // Method 4: Look for image URLs in script tags (JSON data)
      if (uniqueUrls.size === 0) {
        const jsonRegex = /"url":"([^"]+\.(?:jpg|jpeg|png|webp))"/gi;
        const jsonMatches = Array.from(htmlContent.matchAll(jsonRegex));
        
        if (jsonMatches.length > 0) {
          console.log(`Found ${jsonMatches.length} images in JSON data`);
          
          for (const match of jsonMatches) {
            const imageUrl = match[1].replace(/\\u002F/g, '/').replace(/\\\//g, '/');
            if (imageUrl && !uniqueUrls.has(imageUrl)) {
              uniqueUrls.add(imageUrl);
            }
          }
        }
      }
      
      // Method 5: Try to extract from a JavaScript variable or encoded data
      if (uniqueUrls.size === 0) {
        // Look for various patterns of JavaScript image arrays
        const scriptPatterns = [
          /var\s+images\s*=\s*(\[.+?\])\s*;/s,
          /var\s+pages\s*=\s*(\[.+?\])\s*;/s,
          /var\s+chapter_images\s*=\s*(\[.+?\])\s*;/s,
          /var\s+chapterImages\s*=\s*(\[.+?\])\s*;/s,
          /images:\s*(\[.+?\])/s,
          /data-images\s*=\s*'([^']+)'/s
        ];
        
        for (const pattern of scriptPatterns) {
          const scriptMatch = htmlContent.match(pattern);
          if (scriptMatch && scriptMatch[1]) {
            try {
              // Try to parse the JSON data
              let imgData;
              try {
                imgData = JSON.parse(scriptMatch[1]);
              } catch (e) {
                // If direct parsing fails, try to clean the string
                const cleanData = scriptMatch[1].replace(/\\'/g, "'").replace(/'/g, '"');
                imgData = JSON.parse(cleanData);
              }
              
              if (Array.isArray(imgData) && imgData.length > 0) {
                console.log(`Found ${imgData.length} images in script data`);
                
                for (const img of imgData) {
                  const imgUrl = typeof img === 'string' ? img : (img.url || img.src || img.path || img.i || img.img || '');
                  if (imgUrl && !uniqueUrls.has(imgUrl)) {
                    uniqueUrls.add(imgUrl);
                  }
                }
                
                // Break if we found images
                if (uniqueUrls.size > 0) break;
              }
            } catch (e) {
              console.error("Error parsing image data from script:", e);
            }
          }
        }
      }
      
      // Method 6: If we still don't have any images, look for any URLs that match common image patterns
      if (uniqueUrls.size === 0) {
        const broadImageRegex = /https?:\/\/[^"'\s)]+\.(?:jpg|jpeg|png|webp)(?:[^"'\s)]|$)/gi;
        const broadMatches = Array.from(htmlContent.matchAll(broadImageRegex));
        
        if (broadMatches.length > 0) {
          console.log(`Found ${broadMatches.length} images with broad matching`);
          
          for (const match of broadMatches) {
            const imageUrl = match[0].trim();
            // Filter out small images by looking at the URL pattern
            if (!imageUrl || 
                imageUrl.includes('avatar') || 
                imageUrl.includes('icon') || 
                imageUrl.includes('logo') || 
                imageUrl.includes('banner') ||
                imageUrl.includes('thumb') && imageUrl.includes('small')) {
              continue;
            }
            
            if (!uniqueUrls.has(imageUrl)) {
              uniqueUrls.add(imageUrl);
            }
          }
        }
      }
      
      // Convert the unique URLs set back to an array with index
      const pages = Array.from(uniqueUrls).map((url, index) => ({
        url,
        index: index + 1
      }));
      
      // Sort pages by index to ensure correct order
      pages.sort((a, b) => a.index - b.index);
      
      console.log(`Retrieved ${pages.length} pages for chapter ID: ${chapterId}`);
      return pages;
    } catch (error) {
      console.error(`MangaBuddy chapter pages error:`, error);
      throw new Error(`Failed to fetch chapter pages from MangaBuddy: ${error.message}`);
    }
  }
}

module.exports = MangaBuddyProvider; 