const AnilistProvider = require('./anilist');
const MangadexProvider = require('./mangadex');
const AsuraScansProvider = require('./asurascans');
const MangaParkProvider = require('./mangapark');
const MangaBuddyProvider = require('./mangabuddy');
const MangaKakalotProvider = require('./mangakakalot');

class Mapper {
  constructor() {
    this.anilist = new AnilistProvider();
    this.mangadex = new MangadexProvider();
    this.asurascans = new AsuraScansProvider();
    this.mangapark = new MangaParkProvider();
    this.mangabuddy = new MangaBuddyProvider();
    this.mangakakalot = new MangaKakalotProvider();
  }

  // Helper function to calculate string similarity (Levenshtein distance)
  stringSimilarity(s1, s2) {
    if (!s1 || !s2) return 0;
    
    const longer = s1.length >= s2.length ? s1.toLowerCase() : s2.toLowerCase();
    const shorter = s1.length >= s2.length ? s2.toLowerCase() : s1.toLowerCase();
    
    const longerLength = longer.length;
    if (longerLength === 0) return 1.0;
    
    return (longerLength - this.editDistance(longer, shorter)) / longerLength;
  }

  editDistance(s1, s2) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();

    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  async getChaptersByAnilistId(anilistId) {
    try {
      // Step 1: Get anime info from Anilist
      const animeInfo = await this.anilist.getInfo(anilistId);
      
      // Choose the best title to use for searching
      const searchTitle = animeInfo.title.english || animeInfo.title.romaji || "Manga";
      console.log(`Searching for manga: ${searchTitle}`);
      
      // Step 2: Search for manga on MangaDex using the title
      const searchResults = await this.mangadex.search(searchTitle);
      
      if (!searchResults || !searchResults.results || searchResults.results.length === 0) {
        throw new Error(`No matching manga found on Mangadex for title: ${searchTitle}`);
      }
      
      console.log(`Found ${searchResults.results.length} results`);
      
      // Step 3: Find the best matching title using string similarity
      let bestMatch = null;
      let highestSimilarity = 0;
      
      // Try to match with both romaji and english titles if available
      const titlesToMatch = [
        animeInfo.title.romaji,
        animeInfo.title.english
      ].filter(Boolean);
      
      for (const manga of searchResults.results) {
        let maxSimilarity = 0;
        
        // Check against each available title format
        for (const titleToMatch of titlesToMatch) {
          const similarity = this.stringSimilarity(manga.title, titleToMatch);
          maxSimilarity = Math.max(maxSimilarity, similarity);
          
          // Also check alternative titles
          if (manga.altTitles && manga.altTitles.length > 0) {
            for (const altTitle of manga.altTitles) {
              for (const lang in altTitle) {
                const altSimilarity = this.stringSimilarity(altTitle[lang], titleToMatch);
                maxSimilarity = Math.max(maxSimilarity, altSimilarity);
              }
            }
          }
        }
        
        if (maxSimilarity > highestSimilarity) {
          highestSimilarity = maxSimilarity;
          bestMatch = manga;
        }
      }
      
      if (!bestMatch || highestSimilarity < 0.4) { // Lower threshold for accepting a match
        // If no good match, just use the first result
        bestMatch = searchResults.results[0];
        console.log(`No similar manga found, using first result: ${bestMatch.title}`);
      }
      
      console.log(`Found best match: ${bestMatch.title} (ID: ${bestMatch.id}), similarity: ${highestSimilarity}`);
      
      // Step 4: Get full manga info with chapters from Mangadex
      const mangadexInfo = await this.mangadex.getMangaInfo(bestMatch.id);
      
      // Step 5: Return the mapped information with chapters, only essentials
      return {
        anilist: {
          id: anilistId,
          title: animeInfo.title.english || animeInfo.title.romaji
        },
        mangadex: {
          id: bestMatch.id,
          title: bestMatch.title,
          chapters: mangadexInfo.chapters || []
        }
      };
      
    } catch (error) {
      console.error("Mapping error:", error);
      throw new Error(`Mapping error: ${error.message}`);
    }
  }

  // Method to search using AsuraScans
  async searchAsuraScans(title, synonyms = []) {
    try {
      console.log(`Searching for manga on AsuraScans: ${title}`);
      
      // Use the AsuraScans provider to search for manga
      const searchResults = await this.asurascans.search(title);
      
      if (!searchResults || !searchResults.results || searchResults.results.length === 0) {
        // If no results found with main title, try synonyms if available
        if (synonyms && synonyms.length > 0) {
          console.log(`No results with main title. Trying synonyms: ${synonyms.join(', ')}`);
          
          // Try each synonym until we find results
          for (const synonym of synonyms) {
            console.log(`Trying synonym: ${synonym}`);
            const synonymResults = await this.asurascans.search(synonym);
            
            if (synonymResults && synonymResults.results && synonymResults.results.length > 0) {
              console.log(`Found ${synonymResults.results.length} results using synonym: ${synonym}`);
              return this.findBestMatch(synonymResults.results, title, synonyms);
            }
          }
        }
        
        throw new Error(`No matching manga found on AsuraScans for title: ${title}`);
      }
      
      console.log(`Found ${searchResults.results.length} results on AsuraScans`);
      
      // Find the best match using title and synonyms
      return this.findBestMatch(searchResults.results, title, synonyms);
    } catch (error) {
      console.error(`AsuraScans search error:`, error);
      throw new Error(`Failed to search manga on AsuraScans: ${error.message}`);
    }
  }
  
  // Method to search using MangaPark
  async searchMangaPark(title, synonyms = []) {
    try {
      console.log(`Searching for manga on MangaPark: ${title}`);
      
      // Use the MangaPark provider to search for manga
      const searchResults = await this.mangapark.search(title);
      
      if (!searchResults || !searchResults.results || searchResults.results.length === 0) {
        // If no results found with main title, try synonyms if available
        if (synonyms && synonyms.length > 0) {
          console.log(`No results with main title. Trying synonyms: ${synonyms.join(', ')}`);
          
          // Try each synonym until we find results
          for (const synonym of synonyms) {
            console.log(`Trying synonym: ${synonym}`);
            const synonymResults = await this.mangapark.search(synonym);
            
            if (synonymResults && synonymResults.results && synonymResults.results.length > 0) {
              console.log(`Found ${synonymResults.results.length} results using synonym: ${synonym}`);
              return this.findBestMatch(synonymResults.results, title, synonyms);
            }
          }
        }
        
        throw new Error(`No matching manga found on MangaPark for title: ${title}`);
      }
      
      console.log(`Found ${searchResults.results.length} results on MangaPark`);
      
      // Find the best match using title and synonyms
      return this.findBestMatch(searchResults.results, title, synonyms);
    } catch (error) {
      console.error(`MangaPark search error:`, error);
      throw new Error(`Failed to search manga on MangaPark: ${error.message}`);
    }
  }
  
  // Helper method to find best match considering both title and synonyms
  findBestMatch(results, title, synonyms = []) {
    // Find the best matching title using string similarity
    let bestMatch = null;
    let highestSimilarity = 0;
    let matchSource = '';
    
    // Check main title first
    for (const manga of results) {
      const similarity = this.stringSimilarity(manga.title, title);
      
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = manga;
        matchSource = 'main title';
      }
    }
    
    // Also check against synonyms to potentially find better matches
    if (synonyms && synonyms.length > 0) {
      for (const manga of results) {
        for (const synonym of synonyms) {
          const similarity = this.stringSimilarity(manga.title, synonym);
          
          if (similarity > highestSimilarity) {
            highestSimilarity = similarity;
            bestMatch = manga;
            matchSource = `synonym "${synonym}"`;
          }
        }
      }
    }
    
    if (!bestMatch || highestSimilarity < 0.3) { // Lower threshold for accepting a match
      // If no good match, just use the first result
      bestMatch = results[0];
      console.log(`No similar manga found, using first result: ${bestMatch.title}`);
      return bestMatch;
    }
    
    console.log(`Found best match: ${bestMatch.title} (ID: ${bestMatch.id}), similarity: ${highestSimilarity} with ${matchSource}`);
    
    return bestMatch;
  }
  
  // Get manga details including chapters from AsuraScans
  async getAsuraScansInfo(mangaId) {
    try {
      console.log(`Fetching manga info from AsuraScans for ID: ${mangaId}`);
      
      // Use the AsuraScans provider to get manga details
      return await this.asurascans.getMangaInfo(mangaId);
    } catch (error) {
      console.error(`AsuraScans info error:`, error);
      throw new Error(`Failed to get manga info from AsuraScans: ${error.message}`);
    }
  }
  
  // Get manga details including chapters from MangaPark
  async getMangaParkInfo(mangaId) {
    try {
      console.log(`Fetching manga info from MangaPark for ID: ${mangaId}`);
      
      // Use the MangaPark provider to get manga details
      return await this.mangapark.getMangaInfo(mangaId);
    } catch (error) {
      console.error(`MangaPark info error:`, error);
      throw new Error(`Failed to get manga info from MangaPark: ${error.message}`);
    }
  }
  
  // Main method to map Anilist ID to AsuraScans chapters
  async getChaptersByAnilistIdFromAsura(anilistId) {
    try {
      // Step 1: Get anime info from Anilist
      const animeInfo = await this.anilist.getInfo(anilistId);
      
      // Get all possible titles to search with
      const searchTitle = animeInfo.title.english || animeInfo.title.romaji || animeInfo.title.native;
      
      // Extract synonyms from Anilist if available
      let synonyms = [];
      if (animeInfo.synonyms && Array.isArray(animeInfo.synonyms)) {
        synonyms = animeInfo.synonyms;
      }
      
      // Also use alternative titles as potential synonyms
      if (animeInfo.title) {
        const altTitles = Object.values(animeInfo.title).filter(Boolean);
        synonyms = [...new Set([...synonyms, ...altTitles])];
      }
      
      console.log(`Searching for manga on AsuraScans: ${searchTitle}`);
      if (synonyms.length > 0) {
        console.log(`Also trying synonyms: ${synonyms.join(', ')}`);
      }
      
      // Step 2: Search for manga on AsuraScans using the title and synonyms
      const bestMatch = await this.searchAsuraScans(searchTitle, synonyms);
      
      // Step 3: Get full manga info with chapters from AsuraScans
      const asuraScansInfo = await this.getAsuraScansInfo(bestMatch.id);
      
      // Step 4: Return the mapped information with chapters
      return {
        anilist: {
          id: anilistId,
          title: animeInfo.title.english || animeInfo.title.romaji
        },
        asurascans: {
          id: bestMatch.id,
          title: bestMatch.title,
          cover: bestMatch.image,
          status: bestMatch.status,
          rating: bestMatch.rating,
          description: asuraScansInfo.description,
          genres: asuraScansInfo.genres,
          chapters: asuraScansInfo.chapters || []
        }
      };
      
    } catch (error) {
      console.error("AsuraScans mapping error:", error);
      throw new Error(`AsuraScans mapping error: ${error.message}`);
    }
  }
  
  // Main method to map Anilist ID to MangaPark chapters
  async getChaptersByAnilistIdFromMangaPark(anilistId) {
    try {
      // Step 1: Get anime info from Anilist
      const animeInfo = await this.anilist.getInfo(anilistId);
      
      // Get all possible titles to search with
      const searchTitle = animeInfo.title.english || animeInfo.title.romaji || animeInfo.title.native;
      
      // Extract synonyms from Anilist if available
      let synonyms = [];
      if (animeInfo.synonyms && Array.isArray(animeInfo.synonyms)) {
        synonyms = animeInfo.synonyms;
      }
      
      // Also use alternative titles as potential synonyms
      if (animeInfo.title) {
        const altTitles = Object.values(animeInfo.title).filter(Boolean);
        synonyms = [...new Set([...synonyms, ...altTitles])];
      }
      
      console.log(`Searching for manga on MangaPark: ${searchTitle}`);
      if (synonyms.length > 0) {
        console.log(`Also trying synonyms: ${synonyms.join(', ')}`);
      }
      
      // Step 2: Search for manga on MangaPark using the title and synonyms
      const bestMatch = await this.searchMangaPark(searchTitle, synonyms);
      
      // Step 3: Get full manga info with chapters from MangaPark
      const mangaParkInfo = await this.getMangaParkInfo(bestMatch.id);
      
      // Step 4: Return the mapped information with chapters
      return {
        anilist: {
          id: anilistId,
          title: animeInfo.title.english || animeInfo.title.romaji
        },
        mangapark: {
          id: bestMatch.id,
          title: bestMatch.title,
          image: bestMatch.image,
          description: mangaParkInfo.description,
          genres: mangaParkInfo.genres || [],
          chapters: mangaParkInfo.chapters || []
        }
      };
      
    } catch (error) {
      console.error("MangaPark mapping error:", error);
      throw new Error(`MangaPark mapping error: ${error.message}`);
    }
  }

  // Method to search using MangaBuddy
  async searchMangaBuddy(title, synonyms = []) {
    try {
      console.log(`Searching for manga on MangaBuddy: ${title}`);
      
      // Use the MangaBuddy provider to search for manga
      const searchResults = await this.mangabuddy.search(title);
      
      if (!searchResults || !searchResults.results || searchResults.results.length === 0) {
        // If no results found with main title, try synonyms if available
        if (synonyms && synonyms.length > 0) {
          console.log(`No results with main title. Trying synonyms: ${synonyms.join(', ')}`);
          
          // Try each synonym until we find results
          for (const synonym of synonyms) {
            console.log(`Trying synonym: ${synonym}`);
            const synonymResults = await this.mangabuddy.search(synonym);
            
            if (synonymResults && synonymResults.results && synonymResults.results.length > 0) {
              console.log(`Found ${synonymResults.results.length} results using synonym: ${synonym}`);
              return this.findBestMatch(synonymResults.results, title, synonyms);
            }
          }
        }
        
        throw new Error(`No matching manga found on MangaBuddy for title: ${title}`);
      }
      
      console.log(`Found ${searchResults.results.length} results on MangaBuddy`);
      
      // Find the best match using title and synonyms
      return this.findBestMatch(searchResults.results, title, synonyms);
    } catch (error) {
      console.error(`MangaBuddy search error:`, error);
      throw new Error(`Failed to search manga on MangaBuddy: ${error.message}`);
    }
  }
  
  // Get manga details including chapters from MangaBuddy
  async getMangaBuddyInfo(mangaId) {
    try {
      console.log(`Fetching manga info from MangaBuddy for ID: ${mangaId}`);
      
      // Use the MangaBuddy provider to get manga details
      return await this.mangabuddy.getMangaInfo(mangaId);
    } catch (error) {
      console.error(`MangaBuddy info error:`, error);
      throw new Error(`Failed to get manga info from MangaBuddy: ${error.message}`);
    }
  }
  
  // Main method to map Anilist ID to MangaBuddy chapters
  async getChaptersByAnilistIdFromMangaBuddy(anilistId) {
    try {
      // Step 1: Get anime info from Anilist
      const animeInfo = await this.anilist.getInfo(anilistId);
      
      // Get all possible titles to search with
      const searchTitle = animeInfo.title.english || animeInfo.title.romaji || animeInfo.title.native;
      
      // Extract synonyms from Anilist if available
      let synonyms = [];
      if (animeInfo.synonyms && Array.isArray(animeInfo.synonyms)) {
        synonyms = animeInfo.synonyms;
      }
      
      // Also use alternative titles as potential synonyms
      if (animeInfo.title) {
        const altTitles = Object.values(animeInfo.title).filter(Boolean);
        synonyms = [...new Set([...synonyms, ...altTitles])];
      }
      
      console.log(`Searching for manga on MangaBuddy: ${searchTitle}`);
      if (synonyms.length > 0) {
        console.log(`Also trying synonyms: ${synonyms.join(', ')}`);
      }
      
      // Step 2: Search for manga on MangaBuddy using the title and synonyms
      const bestMatch = await this.searchMangaBuddy(searchTitle, synonyms);
      
      // Step 3: Get full manga info with chapters from MangaBuddy
      const mangaBuddyInfo = await this.getMangaBuddyInfo(bestMatch.id);
      
      // Step 4: Return the mapped information with chapters
      return {
        anilist: {
          id: anilistId,
          title: animeInfo.title.english || animeInfo.title.romaji
        },
        mangabuddy: {
          id: bestMatch.id,
          title: bestMatch.title,
          image: bestMatch.image,
          description: mangaBuddyInfo.description,
          author: mangaBuddyInfo.author,
          status: mangaBuddyInfo.status,
          genres: mangaBuddyInfo.genres || [],
          chapters: mangaBuddyInfo.chapters || []
        }
      };
      
    } catch (error) {
      console.error("MangaBuddy mapping error:", error);
      throw new Error(`MangaBuddy mapping error: ${error.message}`);
    }
  }

  // Method to search using MangaKakalot
  async searchMangaKakalot(title, synonyms = []) {
    try {
      // Try the main title first
      const searchResults = await this.mangakakalot.search(title);
      
      if (!searchResults || !searchResults.results || searchResults.results.length === 0) {
        // If no results found with main title, try synonyms if available
        if (synonyms && synonyms.length > 0) {
          // Try each synonym until we find results
          for (const synonym of synonyms) {
            // Only try non-empty synonyms
            if (synonym && synonym.trim()) {
              const synonymResults = await this.mangakakalot.search(synonym);
              
              if (synonymResults && synonymResults.results && synonymResults.results.length > 0) {
                return this.findBestMatch(synonymResults.results, title, synonyms);
              }
            }
          }
        }
        
        throw new Error(`No matching manga found on MangaKakalot for title: ${title}`);
      }
      
      // Find the best match using title and synonyms
      return this.findBestMatch(searchResults.results, title, synonyms);
    } catch (error) {
      throw new Error(`Failed to search manga on MangaKakalot: ${error.message}`);
    }
  }
  
  // Get manga details including chapters from MangaKakalot
  async getMangaKakalotInfo(mangaId) {
    try {
      // Use the MangaKakalot provider to get manga details
      return await this.mangakakalot.getMangaInfo(mangaId);
    } catch (error) {
      throw new Error(`Failed to get manga info from MangaKakalot: ${error.message}`);
    }
  }
  
  // Main method to map Anilist ID to MangaKakalot chapters
  async getChaptersByAnilistIdFromMangaKakalot(anilistId) {
    try {
      // Step 1: Get anime info from Anilist
      const animeInfo = await this.anilist.getInfo(anilistId);
      
      // Get all possible titles to search with
      const searchTitle = animeInfo.title.english || animeInfo.title.romaji || animeInfo.title.native;
      
      // Extract synonyms from Anilist if available
      let synonyms = [];
      if (animeInfo.synonyms && Array.isArray(animeInfo.synonyms)) {
        synonyms = animeInfo.synonyms.filter(Boolean);
      }
      
      // Also use alternative titles as potential synonyms
      if (animeInfo.title) {
        const altTitles = Object.values(animeInfo.title).filter(Boolean);
        synonyms = [...new Set([...synonyms, ...altTitles])];
      }
      
      // Step 2: Search for manga on MangaKakalot using the title and synonyms
      const bestMatch = await this.searchMangaKakalot(searchTitle, synonyms);
      
      // Step 3: Get full manga info with chapters from MangaKakalot
      const mangaKakalotInfo = await this.getMangaKakalotInfo(bestMatch.id);
      
      // Step 4: Return the mapped information with chapters
      return {
        anilist: {
          id: anilistId,
          title: animeInfo.title.english || animeInfo.title.romaji
        },
        mangakakalot: {
          id: bestMatch.id,
          title: bestMatch.title,
          image: bestMatch.image,
          altTitles: mangaKakalotInfo.altTitles,
          description: mangaKakalotInfo.description,
          author: mangaKakalotInfo.author,
          status: mangaKakalotInfo.status,
          genres: mangaKakalotInfo.genres || [],
          chapters: mangaKakalotInfo.chapters || []
        }
      };
      
    } catch (error) {
      throw new Error(`MangaKakalot mapping error: ${error.message}`);
    }
  }
}

module.exports = Mapper; 