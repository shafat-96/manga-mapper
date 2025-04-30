const fetch = require('node-fetch');

class AnilistProvider {
  constructor() {
    this.baseUrl = 'https://graphql.anilist.co';
  }

  // Fetch anime info from Anilist GraphQL API
  async getInfo(animeId) {
    try {
      // Expanded query that includes synonyms
      const query = `
        query ($id: Int) {
          Media(id: $id) {
            id
            title {
              romaji
              english
              native
            }
            coverImage {
              large
            }
            synonyms
            format
            status
            description
            genres
          }
        }
      `;
      
      const variables = {
        id: parseInt(animeId)
      };
      
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables
        })
      });
      
      const data = await response.json();
      
      if (data.errors) {
        throw new Error(`Anilist API error: ${data.errors[0].message}`);
      }
      
      if (!data.data || !data.data.Media) {
        throw new Error(`No media found with ID ${animeId}`);
      }
      
      const media = data.data.Media;
      
      // Create a simplified version with more information
      return {
        id: media.id,
        title: {
          romaji: media.title.romaji,
          english: media.title.english,
          native: media.title.native
        },
        coverImage: media.coverImage ? {
          large: media.coverImage.large
        } : null,
        synonyms: media.synonyms || [],
        format: media.format,
        status: media.status,
        description: media.description,
        genres: media.genres || []
      };
    } catch (error) {
      throw new Error(`Failed to fetch anime info: ${error.message}`);
    }
  }

  async search(query) {
    try {
      const graphqlQuery = `
        query ($search: String) {
          Page(page: 1, perPage: 20) {
            media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
              id
              title {
                romaji
                english
                native
              }
              coverImage {
                large
              }
              format
              status
              description
              genres
            }
          }
        }
      `;
      
      const variables = {
        search: query
      };
      
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query: graphqlQuery,
          variables
        })
      });
      
      const data = await response.json();
      
      if (data.errors) {
        throw new Error(`Anilist API error: ${data.errors[0].message}`);
      }
      
      // Map results to a simplified format
      return data.data.Page.media.map(media => ({
        id: media.id,
        title: {
          romaji: media.title.romaji,
          english: media.title.english,
          native: media.title.native
        },
        coverImage: media.coverImage ? {
          large: media.coverImage.large
        } : null,
        format: media.format,
        status: media.status,
        description: media.description,
        genres: media.genres || []
      }));
    } catch (error) {
      throw new Error(`Failed to search anime: ${error.message}`);
    }
  }

  async getTrending() {
    try {
      const query = `
        query {
          Page(page: 1, perPage: 20) {
            media(type: ANIME, sort: TRENDING_DESC) {
              id
              title {
                romaji
                english
                native
              }
              coverImage {
                large
              }
              format
              status
              description
              genres
            }
          }
        }
      `;
      
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ query })
      });
      
      const data = await response.json();
      
      if (data.errors) {
        throw new Error(`Anilist API error: ${data.errors[0].message}`);
      }
      
      // Map results to a simplified format
      return data.data.Page.media.map(media => ({
        id: media.id,
        title: {
          romaji: media.title.romaji,
          english: media.title.english,
          native: media.title.native
        },
        coverImage: media.coverImage ? {
          large: media.coverImage.large
        } : null,
        format: media.format,
        status: media.status,
        description: media.description,
        genres: media.genres || []
      }));
    } catch (error) {
      throw new Error(`Failed to get trending anime: ${error.message}`);
    }
  }
}

module.exports = AnilistProvider; 