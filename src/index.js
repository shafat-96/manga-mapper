const express = require('express');
const Mapper = require('./providers/mapper');
const MangadexProvider = require('./providers/mangadex');
const AsuraScansProvider = require('./providers/asurascans');
const MangaParkProvider = require('./providers/mangapark');
const MangaBuddyProvider = require('./providers/mangabuddy');
const MangaKakalotProvider = require('./providers/mangakakalot');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Initialize mapper and providers
const mapper = new Mapper();
const mangadexProvider = new MangadexProvider();
const asuraScansProvider = new AsuraScansProvider();
const mangaParkProvider = new MangaParkProvider();
const mangaBuddyProvider = new MangaBuddyProvider();
const mangaKakalotProvider = new MangaKakalotProvider();

// AniList to Mangadex mapper - get chapters by AniList ID
app.get('/mangadex/chapters/:anilistId', async (req, res) => {
  try {
    const { anilistId } = req.params;
    
    if (!anilistId || isNaN(parseInt(anilistId))) {
      return res.status(400).json({ 
        error: 'Invalid Anilist ID',
        message: 'Please provide a valid numeric Anilist ID'
      });
    }
    
    const result = await mapper.getChaptersByAnilistId(anilistId);
    
    res.json(result);
  } catch (error) {
    // Check for specific error types
    if (error.message.includes('No media found with ID') || 
        error.message.includes('Anilist API error')) {
      return res.status(404).json({ 
        error: 'Anilist ID not found',
        message: `The Anilist ID ${req.params.anilistId} could not be found. Please verify the ID is correct.`,
        details: error.message
      });
    }
    
    if (error.message.includes('No matching manga found on Mangadex')) {
      return res.status(404).json({ 
        error: 'Manga not found',
        message: 'Could not find matching manga on Mangadex',
        details: error.message
      });
    }
    
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
});

// Fetch chapter pages from MangaDex by chapter ID
app.get('/mangadex/pages/:chapterId', async (req, res) => {
  try {
    const { chapterId } = req.params;
    
    if (!chapterId) {
      return res.status(400).json({ 
        error: 'Invalid Chapter ID',
        message: 'Please provide a valid Chapter ID'
      });
    }
    
    const pages = await mangadexProvider.fetchChapterPages(chapterId);
    
    res.json({
      success: true,
      chapterId,
      pages
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
});

// Fetch chapter pages from MangaPark by chapter ID
app.get('/mangapark/pages/:chapterId', async (req, res) => {
  try {
    const { chapterId } = req.params;
    
    if (!chapterId) {
      return res.status(400).json({ 
        error: 'Invalid Chapter ID',
        message: 'Please provide a valid Chapter ID'
      });
    }
    
    const pages = await mangaParkProvider.fetchChapterPages(chapterId);
    
    res.json({
      success: true,
      chapterId,
      pages
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
});

// Add new route for title format
app.get('/mangapark/pages/title/:mangaId/:chapterId', async (req, res) => {
  try {
    const { mangaId, chapterId } = req.params;
    
    if (!mangaId || !chapterId) {
      return res.status(400).json({ 
        error: 'Invalid Manga ID or Chapter ID',
        message: 'Please provide both a valid Manga ID and Chapter ID'
      });
    }
    
    // Combine the IDs as they appear in the URL path
    const fullChapterId = `${mangaId}/${chapterId}`;
    const pages = await mangaParkProvider.fetchChapterPages(fullChapterId);
    
    res.json({
      success: true,
      mangaId,
      chapterId,
      pages
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
});

// Fetch chapter pages from AsuraScans by chapter ID
app.get('/asurascans/pages/:chapterId', async (req, res) => {
  try {
    const { chapterId } = req.params;
    
    if (!chapterId) {
      return res.status(400).json({ 
        error: 'Invalid Chapter ID',
        message: 'Please provide a valid Chapter ID'
      });
    }
    
    const pages = await asuraScansProvider.fetchChapterPages(chapterId);
    
    res.json({
      success: true,
      chapterId,
      pages
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
});

// Fetch chapter pages from AsuraScans by series and chapter
app.get('/asurascans/pages/series/:seriesId/chapter/:chapterNum', async (req, res) => {
  try {
    const { seriesId, chapterNum } = req.params;
    
    if (!seriesId || !chapterNum) {
      return res.status(400).json({ 
        error: 'Invalid Series or Chapter Number',
        message: 'Please provide both a valid Series ID and Chapter Number'
      });
    }
    
    const chapterId = `${seriesId}/chapter/${chapterNum}`;
    const pages = await asuraScansProvider.fetchChapterPages(chapterId);
    
    res.json({
      success: true,
      seriesId,
      chapterNum,
      pages
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
});

// AniList to AsuraScans mapper - get chapters by AniList ID
app.get('/asurascans/chapters/:anilistId', async (req, res) => {
  try {
    const { anilistId } = req.params;
    
    if (!anilistId || isNaN(parseInt(anilistId))) {
      return res.status(400).json({ 
        error: 'Invalid Anilist ID',
        message: 'Please provide a valid numeric Anilist ID'
      });
    }
    
    const result = await mapper.getChaptersByAnilistIdFromAsura(anilistId);
    
    res.json(result);
  } catch (error) {
    // Check for specific error types
    if (error.message.includes('No media found with ID') || 
        error.message.includes('Anilist API error')) {
      return res.status(404).json({ 
        error: 'Anilist ID not found',
        message: `The Anilist ID ${req.params.anilistId} could not be found. Please verify the ID is correct.`,
        details: error.message
      });
    }
    
    if (error.message.includes('No matching manga found on AsuraScans')) {
      return res.status(404).json({ 
        error: 'Manga not found',
        message: 'Could not find matching manga on AsuraScans',
        details: error.message
      });
    }
    
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
});

// AniList to MangaPark mapper - get chapters by AniList ID
app.get('/mangapark/chapters/:anilistId', async (req, res) => {
  try {
    const { anilistId } = req.params;
    
    if (!anilistId || isNaN(parseInt(anilistId))) {
      return res.status(400).json({ 
        error: 'Invalid Anilist ID',
        message: 'Please provide a valid numeric Anilist ID'
      });
    }
    
    const result = await mapper.getChaptersByAnilistIdFromMangaPark(anilistId);
    
    res.json(result);
  } catch (error) {
    // Check for specific error types
    if (error.message.includes('No media found with ID') || 
        error.message.includes('Anilist API error')) {
      return res.status(404).json({ 
        error: 'Anilist ID not found',
        message: `The Anilist ID ${req.params.anilistId} could not be found. Please verify the ID is correct.`,
        details: error.message
      });
    }
    
    if (error.message.includes('No matching manga found on MangaPark')) {
      return res.status(404).json({ 
        error: 'Manga not found',
        message: 'Could not find matching manga on MangaPark',
        details: error.message
      });
    }
    
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
});

// AniList to MangaBuddy mapper - get chapters by AniList ID
app.get('/mangabuddy/chapters/:anilistId', async (req, res) => {
  try {
    const { anilistId } = req.params;
    
    if (!anilistId || isNaN(parseInt(anilistId))) {
      return res.status(400).json({ 
        error: 'Invalid Anilist ID',
        message: 'Please provide a valid numeric Anilist ID'
      });
    }
    
    const result = await mapper.getChaptersByAnilistIdFromMangaBuddy(anilistId);
    
    res.json(result);
  } catch (error) {
    // Check for specific error types
    if (error.message.includes('No media found with ID') || 
        error.message.includes('Anilist API error')) {
      return res.status(404).json({ 
        error: 'Anilist ID not found',
        message: `The Anilist ID ${req.params.anilistId} could not be found. Please verify the ID is correct.`,
        details: error.message
      });
    }
    
    if (error.message.includes('No matching manga found on MangaBuddy')) {
      return res.status(404).json({ 
        error: 'Manga not found',
        message: 'Could not find matching manga on MangaBuddy',
        details: error.message
      });
    }
    
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
});

// AniList to MangaKakalot mapper - get chapters by AniList ID
app.get('/mangakakalot/chapters/:anilistId', async (req, res) => {
  try {
    const { anilistId } = req.params;
    
    if (!anilistId || isNaN(parseInt(anilistId))) {
      return res.status(400).json({ 
        error: 'Invalid Anilist ID',
        message: 'Please provide a valid numeric Anilist ID'
      });
    }
    
    const result = await mapper.getChaptersByAnilistIdFromMangaKakalot(anilistId);
    
    res.json(result);
  } catch (error) {
    // Check for specific error types
    if (error.message.includes('No media found with ID') || 
        error.message.includes('Anilist API error')) {
      return res.status(404).json({ 
        error: 'Anilist ID not found',
        message: `The Anilist ID ${req.params.anilistId} could not be found. Please verify the ID is correct.`,
        details: error.message
      });
    }
    
    if (error.message.includes('No matching manga found on MangaKakalot')) {
      return res.status(404).json({ 
        error: 'Manga not found',
        message: 'Could not find matching manga on MangaKakalot',
        details: error.message
      });
    }
    
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
});

// Fetch chapter pages from MangaBuddy by chapter ID
app.get('/mangabuddy/pages/:chapterId', async (req, res) => {
  try {
    const { chapterId } = req.params;
    
    if (!chapterId) {
      return res.status(400).json({ 
        error: 'Invalid Chapter ID',
        message: 'Please provide a valid Chapter ID'
      });
    }
    
    const pages = await mangaBuddyProvider.fetchChapterPages(chapterId);
    
    res.json({
      success: true,
      chapterId,
      pages
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
});

// Fetch chapter pages from MangaBuddy by manga ID and chapter ID
app.get('/mangabuddy/pages/:mangaId/:chapterId', async (req, res) => {
  try {
    const { mangaId, chapterId } = req.params;
    
    if (!mangaId || !chapterId) {
      return res.status(400).json({ 
        error: 'Invalid Manga ID or Chapter ID',
        message: 'Please provide both a valid Manga ID and Chapter ID'
      });
    }
    
    // Combine the IDs as they appear in the URL path
    const fullChapterId = `${mangaId}/${chapterId}`;
    const pages = await mangaBuddyProvider.fetchChapterPages(fullChapterId);
    
    res.json({
      success: true,
      mangaId,
      chapterId,
      pages
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
});

// Fetch chapter pages from MangaKakalot by chapter ID
app.get('/mangakakalot/pages/:chapterId', async (req, res) => {
  try {
    const { chapterId } = req.params;
    
    if (!chapterId) {
      return res.status(400).json({ 
        error: 'Invalid Chapter ID',
        message: 'Please provide a valid Chapter ID'
      });
    }
    
    const pages = await mangaKakalotProvider.fetchChapterPages(chapterId);
    
    res.json({
      success: true,
      chapterId,
      pages
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
});

// Fetch chapter pages from MangaKakalot by manga ID and chapter ID
app.get('/mangakakalot/pages/:mangaId/:chapterId', async (req, res) => {
  try {
    const { mangaId, chapterId } = req.params;
    
    if (!mangaId || !chapterId) {
      return res.status(400).json({ 
        error: 'Invalid Manga ID or Chapter ID',
        message: 'Please provide both a valid Manga ID and Chapter ID'
      });
    }
    
    // Combine the IDs as they appear in the URL path
    const fullChapterId = `${mangaId}/${chapterId}`;
    const pages = await mangaKakalotProvider.fetchChapterPages(fullChapterId);
    
    res.json({
      success: true,
      mangaId,
      chapterId,
      pages
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
});

// Home route for basic info
app.get('/', (req, res) => {
  res.json({
    info: 'Anilist to Manga Mapper API',
    endpoints: {
      'GET /mangadex/chapters/:anilistId': 'Get Mangadex chapters by Anilist ID',
      'GET /mangadex/pages/:chapterId': 'Get MangaDex chapter pages by chapter ID',
      'GET /asurascans/chapters/:anilistId': 'Get AsuraScans chapters by Anilist ID',
      'GET /asurascans/pages/series/:seriesId/chapter/:chapterNum': 'Get AsuraScans chapter pages by series ID and chapter number',
      'GET /mangapark/chapters/:anilistId': 'Get MangaPark chapters by Anilist ID',
      'GET /mangapark/pages/title/:mangaId/:chapterId': 'Get MangaPark chapter pages by chapter ID',
      'GET /mangabuddy/chapters/:anilistId': 'Get MangaBuddy chapters by Anilist ID',
      'GET /mangabuddy/pages/:mangaId/:chapterId': 'Get MangaBuddy chapter pages by manga ID and chapter ID',
      'GET /mangakakalot/chapters/:anilistId': 'Get MangaKakalot chapters by Anilist ID',
      'GET /mangakakalot/pages/:mangaId/:chapterId': 'Get MangaKakalot chapter pages by manga ID and chapter ID'
    },
    usage: 'Use a valid Anilist ID to fetch corresponding chapters from Mangadex, AsuraScans, MangaPark, MangaBuddy, or MangaKakalot, or use a chapter ID to fetch chapter pages from MangaDex, AsuraScans, MangaPark, MangaBuddy, or MangaKakalot'
  });
});

// Not found handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  res.status(500).json({ 
    error: 'Internal server error', 
    message: err.message 
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`API available at http://localhost:${port}`);
}); 