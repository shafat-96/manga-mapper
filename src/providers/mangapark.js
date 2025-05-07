const fetch = require('node-fetch');
const cheerio = require('cheerio');

class MangaParkProvider {
  constructor() {
    this.baseUrl = 'https://mangapark.net';
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
      throw new Error(`Network error: ${error.message}`);
    }
  }

  /**
   * Search for manga on MangaPark website
   * @param {string} query - The search query
   * @returns {Promise<Object>} - Search results
   */
  async search(query) {
    try {
      console.log(`Searching MangaPark for: ${query}`);
      
      // Format the query for URL
      const formattedQuery = encodeURIComponent(query);
      const searchUrl = `${this.baseUrl}/search?word=${formattedQuery}`;
      
      // Fetch search results HTML
      const htmlContent = await this.fetchHtml(searchUrl);
      const $ = cheerio.load(htmlContent);
      
      // Extract search results
      const results = [];
      const mangaItems = $('div.flex.border-b.border-b-base-200.pb-5');
      
      mangaItems.each((i, el) => {
        const title = $(el).find('h3.font-bold a span span').text().trim();
        
        // For direct scraping, we include all results and let the mapper handle matching
        const id = $(el).find('h3.font-bold a').attr('href')?.replace('/title/', '');
        if (!id) return;
        
        const image = $(el).find('img').attr('src');
        
        // Extract alternative titles
        const altTitles = [];
        $(el).find('div.text-xs.opacity-80.line-clamp-2 span span').each((i, span) => {
          const altTitle = $(span).text().trim();
          if (altTitle && !altTitle.includes('/')) {
            altTitles.push(altTitle);
          }
        });
        
        // Extract authors
        const authors = [];
        const authorDiv = $(el).find('div.text-xs.opacity-80.line-clamp-2').eq(1);
        authorDiv.find('span span').each((i, span) => {
          const author = $(span).text().trim();
          if (author && !author.includes('/')) {
            authors.push(author);
          }
        });
        
        // Extract genres
        const genres = [];
        $(el).find('div.flex.flex-wrap.text-xs.opacity-70 span span').each((i, span) => {
          const genre = $(span).text().trim();
          if (genre) {
            genres.push(genre);
          }
        });
        
        results.push({
          id,
          title,
          altTitles,
          image: image && image.startsWith('/') ? `${this.baseUrl}${image}` : image,
          authors,
          genres
        });
      });
      
      console.log(`Found ${results.length} manga results on MangaPark`);
      
      return {
        results
      };
    } catch (error) {
      console.error(`MangaPark search error:`, error);
      throw new Error(`Failed to search manga on MangaPark: ${error.message}`);
    }
  }

  /**
   * Get manga details including chapters directly from MangaPark
   * @param {string} mangaId - The manga ID
   * @returns {Promise<Object>} - The manga details with chapters
   */
  async getMangaInfo(mangaId) {
    try {
      console.log(`Fetching manga info from MangaPark for ID: ${mangaId}`);
      
      // Fetch manga page HTML
      const url = `${this.baseUrl}/title/${mangaId}`;
      const htmlContent = await this.fetchHtml(url);
      const $ = cheerio.load(htmlContent);
      
      // Extract basic manga info
      const title = $('title').text().split(' - ')[0].trim();
      const image = $('meta[property="og:image"]').attr('content');
      
      // Extract description
      const description = $('.limit-html-p').text().trim();
      
      // Extract genres
      const genres = [];
      $('.whitespace-nowrap.font-bold.border-b').each((i, el) => {
        genres.push($(el).text().trim());
      });
      
      // Extract chapters with improved detection
      const chapters = [];
      const chapterMap = new Map(); // Use a map to track unique chapter numbers
      
      // First pass - extract all chapter elements with their numbers
      $('div[data-name="chapter-list"] a').each((i, el) => {
        const chapterHref = $(el).attr('href');
        if (!chapterHref) return;
        
        const chapterText = $(el).text().trim();
        let chapterNum = null;
        
        // Extract chapter number from text like "Chapter 151" - more robust pattern
        const chapterMatch = chapterText.match(/Chapter\s+(\d+\.?\d*)/i);
        if (chapterMatch) {
          chapterNum = parseFloat(chapterMatch[1]);
        } else {
          // Try alternative formats like "Ch. 123" or "Ch 123"
          const altMatch = chapterText.match(/Ch\.?\s*(\d+\.?\d*)/i);
          if (altMatch) {
            chapterNum = parseFloat(altMatch[1]);
          } else {
            // Try to extract just a number if it's the only number in the string
            const numMatch = chapterText.match(/(\d+\.?\d*)/);
            if (numMatch && numMatch.length === 2) {
              chapterNum = parseFloat(numMatch[1]);
            }
          }
        }
        
        // Skip if we couldn't extract a chapter number
        if (chapterNum === null) return;

        // Get the chapter container div to extract time info
        const chapterDiv = $(el).closest('.px-2.py-2');
        const timeElement = chapterDiv.find('time span');
        const date = timeElement.text().trim();
        
        // Extract the unique chapter ID from the URL - this is the important part for MangaPark
        // The format can be one of these patterns:
        // - /title/87295-en-eleceed/9605874-chapter-345
        // - /title/87295-en-eleceed/2797954-ch-227
        // - /title/11784-en-berserk/7707927-volume-19-chapter-166
        let uniqueChapterId = '';
        const hrefParts = chapterHref.split('/');
        
        // Get the last part of the URL which should contain the chapter identifier
        if (hrefParts.length > 0) {
          const lastPart = hrefParts[hrefParts.length - 1];
          // Check if it matches known patterns
          if (lastPart.match(/\d+-chapter-\d+/) || 
              lastPart.match(/\d+-ch-\d+/) || 
              lastPart.match(/\d+-volume-\d+-chapter-\d+/)) {
            uniqueChapterId = lastPart;
          }
        }
        
        // If we couldn't extract a unique ID, use a generic format with the chapter number
        if (!uniqueChapterId) {
          uniqueChapterId = `chapter-${chapterNum}`;
        }
        
        const chapter = {
          id: uniqueChapterId, // Use the extracted unique ID instead of just chapter-N
          title: chapterText,
          number: chapterNum.toString(),
          url: chapterHref.startsWith('/') ? `${this.baseUrl}${chapterHref}` : chapterHref,
          date: date || 'Unknown'
        };
        
        // Track unique chapter numbers - keep the latest upload if duplicates exist
        if (!chapterMap.has(chapterNum) || !chapterMap.get(chapterNum).date === 'Unknown') {
          chapterMap.set(chapterNum, chapter);
        }
      });
      
      // Convert map values to array
      const extractedChapters = Array.from(chapterMap.values());
      
      // Find the highest chapter number to generate a complete sequence if needed
      let highestChapterNum = 0;
      for (const chapter of extractedChapters) {
        const num = parseFloat(chapter.number);
        if (!isNaN(num) && num > highestChapterNum) {
          highestChapterNum = num;
        }
      }
      
      console.log(`Highest chapter number found: ${highestChapterNum}`);
      
      // Check if we need to generate missing chapters
      const shouldGenerateChapters = highestChapterNum > 0 && extractedChapters.length < highestChapterNum / 2;
      
      if (shouldGenerateChapters) {
        console.log(`Generating complete chapter sequence (1-${highestChapterNum})`);
        
        // Generate all chapters from 1 to highestChapterNum
        for (let i = 1; i <= highestChapterNum; i++) {
          if (!chapterMap.has(i)) {
            // Check if we can construct a URL for this chapter based on existing chapters
            let chapterUrl = "";
            let generatedId = `chapter-${i}`;
            
            // Try to find a template from existing chapters with similar numbers
            const nearbyChapters = extractedChapters.filter(ch => 
              Math.abs(parseFloat(ch.number) - i) < 5 && 
              (ch.id.includes('-chapter-') || ch.id.includes('-ch-'))
            );
            
            if (nearbyChapters.length > 0) {
              // Use the pattern from a nearby chapter
              const template = nearbyChapters[0];
              
              // Handle various URL patterns
              if (template.id.match(/\d+-volume-\d+-chapter-\d+/)) {
                // Handle volume format like "7707927-volume-19-chapter-166"
                // Extract volume number to maintain consistency
                const volumeMatch = template.id.match(/volume-(\d+)/);
                const volumeNum = volumeMatch ? volumeMatch[1] : '1';
                
                generatedId = `chapter-${i}`;
                // Try to preserve the volume number in the URL
                chapterUrl = template.url.replace(/\/\d+-volume-\d+-chapter-\d+$/, `/volume-${volumeNum}-${generatedId}`);
              } else if (template.id.match(/\d+-chapter-\d+/)) {
                // Handle simple chapter format like "9605874-chapter-345"
                generatedId = `chapter-${i}`;
                chapterUrl = template.url.replace(/\/\d+-chapter-\d+$/, `/${generatedId}`);
              } else if (template.id.match(/\d+-ch-\d+/)) {
                // Handle ch format like "2797954-ch-227"
                generatedId = `ch-${i}`;
                chapterUrl = template.url.replace(/\/\d+-ch-\d+$/, `/${generatedId}`);
              } else {
                // Generic fallback
                generatedId = `chapter-${i}`;
                chapterUrl = template.url.replace(/\/chapter-\d+$/, `/${generatedId}`);
              }
            } else {
              // Fallback to basic URL
              chapterUrl = `${this.baseUrl}/title/${mangaId}/${generatedId}`;
            }
            
            // Add the generated chapter
            const generatedChapter = {
              id: generatedId,
              title: `Chapter ${i}`,
              number: i.toString(),
              url: chapterUrl,
              date: 'Unknown',
              generated: true // Mark as generated
            };
            
            chapterMap.set(i, generatedChapter);
          }
        }
        
        // Update chapters array with all values
        chapters.push(...Array.from(chapterMap.values()));
      } else {
        // Just use the extracted chapters
        chapters.push(...extractedChapters);
      }
      
      // Sort chapters by chapter number (descending)
      chapters.sort((a, b) => (parseFloat(b.number) || 0) - (parseFloat(a.number) || 0));
      
      console.log(`Found ${extractedChapters.length} chapters directly on page`);
      console.log(`Returning ${chapters.length} total chapters for manga: ${title}`);
      
      return {
        id: mangaId,
        title,
        image: image && image.startsWith('/') ? `${this.baseUrl}${image}` : image,
        description,
        genres,
        chapters
      };
    } catch (error) {
      console.error(`MangaPark info error:`, error);
      throw new Error(`Failed to get manga info from MangaPark: ${error.message}`);
    }
  }

  /**
   * Fetch chapter pages from MangaPark
   * @param {string} chapterId - The chapter ID
   * @returns {Promise<Array>} - Array of pages with image URLs
   */
  async fetchChapterPages(chapterId) {
    try {
      console.log(`Fetching chapter pages from MangaPark for chapter ID: ${chapterId}`);
      
      // Handle different formats of chapterId
      let chapterUrl;
      
      if (chapterId.startsWith('http')) {
        // Already a full URL
        chapterUrl = chapterId;
      } else if (chapterId.includes('/')) {
        // Format like "mangaId/chapter-123" or "10953-en-one-piece/9427378-chapter-1137"
        chapterUrl = `${this.baseUrl}/title/${chapterId}`;
      } else {
        // Assume it's just the unique chapter identifier
        chapterUrl = `${this.baseUrl}/title/${chapterId}`;
      }
      
      console.log(`Requesting URL: ${chapterUrl}`);
      
      // Fetch chapter page HTML
      const htmlContent = await this.fetchHtml(chapterUrl);
      
      // Extract images using various methods
      let pages = [];
      
      // Method 1: Look for image URLs in script tags (JSON data)
      const jsonRegex = /"url":"([^"]+\.(?:jpg|jpeg|png|webp))"/gi;
      const jsonMatches = Array.from(htmlContent.matchAll(jsonRegex));
      
      if (jsonMatches.length > 0) {
        console.log(`Found ${jsonMatches.length} images in JSON data`);
        let index = 1;
        for (const match of jsonMatches) {
          const imageUrl = match[1].replace(/\\u002F/g, '/').replace(/\\\//g, '/');
          if (imageUrl && !pages.some(p => p.url === imageUrl)) {
            pages.push({
              url: imageUrl,
              index: index++
            });
          }
        }
      }
      
      // Method 2: Check for specific image domains used by MangaPark
      const mpDomainRegex = /https?:\/\/(?:[a-z0-9-]+\.)?mp[a-z]{3,4}\.org\/media\/[^"'\s)]+\.(?:jpg|jpeg|png|webp)/gi;
      const mpDomainMatches = Array.from(htmlContent.matchAll(mpDomainRegex));
      
      if (mpDomainMatches.length > 0) {
        console.log(`Found ${mpDomainMatches.length} images from MangaPark domains`);
        const existingUrls = new Set(pages.map(p => p.url));
        let index = pages.length + 1;
        
        for (const match of mpDomainMatches) {
          const imageUrl = match[0];
          if (imageUrl && !existingUrls.has(imageUrl)) {
            existingUrls.add(imageUrl);
            pages.push({
              url: imageUrl,
              index: index++
            });
          }
        }
      }
      
      // Method 3: Find images in data-src or src attributes
      if (pages.length === 0) {
        const imageRegex = /data-?src="([^"]+)"|src="([^"]+\.(?:jpg|jpeg|png|webp))"/gi;
        const matches = Array.from(htmlContent.matchAll(imageRegex));
        
        if (matches.length > 0) {
          console.log(`Found ${matches.length} images in HTML attributes`);
          const existingUrls = new Set(pages.map(p => p.url));
          let index = pages.length + 1;
          
          for (const match of matches) {
            const imageUrl = match[1] || match[2]; // Get the URL from either capture group
            if (!imageUrl) continue;
            
            // Skip small images, avatars, icons, etc.
            if (imageUrl.includes('avatar') || imageUrl.includes('icon') || 
                imageUrl.includes('logo') || imageUrl.includes('banner')) {
              continue;
            }
            
            // Only include actual chapter images (usually larger files)
            if (imageUrl.match(/\.(?:jpg|jpeg|png|webp)(?:\?|$)/i)) {
              const fullUrl = imageUrl.startsWith('http') 
                ? imageUrl 
                : (imageUrl.startsWith('/') ? `${this.baseUrl}${imageUrl}` : `${this.baseUrl}/${imageUrl}`);
              
              if (!existingUrls.has(fullUrl)) {
                existingUrls.add(fullUrl);
                pages.push({
                  url: fullUrl,
                  index: index++
                });
              }
            }
          }
        }
      }
      
      // Method 4: Try to extract from a JavaScript variable or encoded data
      if (pages.length === 0) {
        // Look for various patterns of JavaScript image arrays
        const scriptPatterns = [
          /var\s+imglist\s*=\s*(\[.+?\])\s*;/s,
          /var\s+images\s*=\s*(\[.+?\])\s*;/s,
          /var\s+pages\s*=\s*(\[.+?\])\s*;/s,
          /var\s+chapterImages\s*=\s*(\[.+?\])\s*;/s,
          /_load\((\[.*?\])\)/s,
          /data-?images\s*=\s*'([^']+)'/s
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
                
                const existingUrls = new Set(pages.map(p => p.url));
                let index = pages.length + 1;
                
                for (const img of imgData) {
                  const imgUrl = typeof img === 'string' ? img : (img.url || img.src || img.path || img.i || img.img || '');
                  if (imgUrl && !existingUrls.has(imgUrl)) {
                    existingUrls.add(imgUrl);
                    pages.push({
                      url: imgUrl,
                      index: index++
                    });
                  }
                }
                
                // Break if we found images
                if (pages.length > 0) break;
              }
            } catch (e) {
              console.error("Error parsing image data from script:", e);
            }
          }
        }
      }
      
      // If we still don't have any images, look for any URLs that match common image patterns
      if (pages.length === 0) {
        const broadImageRegex = /https?:\/\/[^"'\s)]+\.(?:jpg|jpeg|png|webp)(?:[^"'\s)]|$)/gi;
        const broadMatches = Array.from(htmlContent.matchAll(broadImageRegex));
        
        if (broadMatches.length > 0) {
          console.log(`Found ${broadMatches.length} images with broad matching`);
          let index = 1;
          const existingUrls = new Set();
          
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
            
            if (!existingUrls.has(imageUrl)) {
              existingUrls.add(imageUrl);
              pages.push({
                url: imageUrl,
                index: index++
              });
            }
          }
        }
      }
      
      // Sort pages by index to ensure correct order
      pages.sort((a, b) => a.index - b.index);
      
      console.log(`Retrieved ${pages.length} pages for chapter ID: ${chapterId}`);
      return pages;
    } catch (error) {
      console.error(`MangaPark chapter pages error:`, error);
      throw new Error(`Failed to fetch chapter pages from MangaPark: ${error.message}`);
    }
  }
}

module.exports = MangaParkProvider; 