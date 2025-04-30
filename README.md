# Manga Provider API

A comprehensive Express.js application that aggregates manga chapters from multiple providers including MangaDex, AsuraScans, MangaPark, MangaBuddy, and MangaKakalot.

## 📚 Features

- 🌐 Multi-provider support:
  - MangaDex
  - AsuraScans
  - MangaPark
  - MangaBuddy
  - MangaKakalot
- 🔄 Standardized chapter format across all providers
- ⚡ Fast and efficient chapter page retrieval
- 🔍 Smart title matching with Anilist
- 🕒 Real-time chapter date information

## 🚀 Quick Start

1. Clone this repository
```bash
git clone <repository-url>
cd manga-provider-api
```

2. Install dependencies
```bash
npm install
```

3. Start the server
```bash
npm start
```

## 🛣️ API Endpoints

### MangaDex
- `GET /mangadex/chapters/:anilistId` - Get chapters by Anilist ID
- `GET /mangadex/pages/:chapterId` - Get chapter pages by chapter ID

### AsuraScans
- `GET /asurascans/chapters/:anilistId` - Get chapters by Anilist ID
- `GET /asurascans/pages/series/:seriesId/chapter/:chapterNum` - Get chapter pages

### MangaPark
- `GET /mangapark/chapters/:anilistId` - Get chapters by Anilist ID
- `GET /mangapark/pages/title/:mangaId/:chapterId` - Get chapter pages

### MangaBuddy
- `GET /mangabuddy/chapters/:anilistId` - Get chapters by Anilist ID
- `GET /mangabuddy/pages/:mangaId/:chapterId` - Get chapter pages

### MangaKakalot
- `GET /mangakakalot/chapters/:anilistId` - Get chapters by Anilist ID
- `GET /mangakakalot/pages/:mangaId/:chapterId` - Get chapter pages

## 📝 Example Usage

```bash
# Get MangaDex chapters
curl http://localhost:3000/mangadex/chapters/1

# Get AsuraScans chapter pages
curl http://localhost:3000/asurascans/pages/series/123/chapter/1

# Get MangaPark chapters
curl http://localhost:3000/mangapark/chapters/1
```

## 📊 Response Formats

### Chapters Response
```javascript
{
  "success": true,
  "chapters": [
    {
      "id": "chapter-1",
      "title": "Chapter 1",
      "number": "1",
      "url": "https://provider.com/manga/chapter-1",
      "date": "2 days ago"
    }
  ]
}
```

### Pages Response
```javascript
{
  "success": true,
  "pages": [
    {
      "url": "https://provider.com/images/page1.jpg",
      "index": 1
    }
  ]
}
```

## 📁 Project Structure

```
.
├── src/
│   ├── index.js
│   └── providers/
│       ├── anilist.js
│       ├── asurascans.js
│       ├── mangadex.js
│       ├── mangapark.js
│       ├── mangabuddy.js
│       ├── mangakakalot.js
│       └── mapper.js
├── package.json
├── vercel.json
└── README.md
```

## 🛠️ Technologies Used

- **Express.js** - Fast, unopinionated web framework
- **Cheerio** - Efficient HTML parsing for web scraping
- **Node-fetch** - Lightweight HTTP client
- **@consumet/extensions** - Provider implementations
- **String-similarity** - Title matching algorithms

## 🔧 Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## 📄 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request 