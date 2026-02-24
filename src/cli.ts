#!/usr/bin/env node
import { Command } from 'commander';
import { Page } from 'playwright';
import { likeCommentById, replyToCommentById, unlikeCommentById } from './behaviors/interact-with-comment';
import { bookmarkPost, likePost, postThread, postTweet, quoteTweet, replyToPost, retweetPost, unbookmarkPost, unlikePost, unretweetPost } from './behaviors/interact-with-post';
import { getAuthenticatedPage, login } from './behaviors/login';
import { SearchPresets, getTopComments, scrapeComments, scrapePosts, scrapeProfile, scrapeTimeline, scrapeTrendingTopics, searchTwitter } from './scrapers';
import { TweetWithMedia } from './types';

const program = new Command();

let authenticatedPage: Page | null = null;
let browserContextClose: (() => Promise<void>) | null = null;

// Helper function to ensure authentication
async function ensureAuthenticated(): Promise<Page> {
  if (!authenticatedPage) {
    const { page, close } = await getAuthenticatedPage();
    authenticatedPage = page;
    browserContextClose = close;
  }
  return authenticatedPage;
}

// Cleanup function
async function cleanup() {
  if (browserContextClose) {
    await browserContextClose();
  }
  process.exit(0);
}

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

program
  .name('twitter-cli')
  .description('CLI for Twitter/X automation tools')
  .version('1.0.0');

// Authentication command
program
  .command('login')
  .description('Login to Twitter/X')
  .action(async () => {
    try {
      await login();
      console.log('✅ Successfully logged in to Twitter/X');
    } catch (error) {
      console.error('❌ Login failed:', error);
      process.exit(1);
    }
    process.exit(0);
  });

// Tweet command
program
  .command('tweet')
  .description('Post a tweet')
  .requiredOption('-t, --text <text>', 'Tweet text')
  .option('-m, --media <paths...>', 'Media file paths')
  .action(async (options: { text: string; media?: string[] }) => {
    try {
      const page = await ensureAuthenticated();
      const tweetData: TweetWithMedia = {
        text: options.text,
        media: options.media
      };
      await postTweet(page, tweetData);
      console.log(`✅ Tweet posted: "${options.text}"${options.media ? ` with ${options.media.length} media file(s)` : ''}`);
    } catch (error) {
      console.error('❌ Tweet failed:', error);
      process.exit(1);
    }
    process.exit(0);
  });

// Thread command
program
  .command('thread')
  .description('Post a thread of tweets')
  .requiredOption('-t, --tweets <tweets...>', 'Tweet texts (separate with spaces, use quotes for multi-word tweets)')
  .action(async (options: { tweets: string[] }) => {
    try {
      const page = await ensureAuthenticated();
      const tweetsData: TweetWithMedia[] = options.tweets.map((text: string) => ({ text }));
      await postThread(page, tweetsData);
      console.log(`✅ Thread posted with ${tweetsData.length} tweets`);
    } catch (error) {
      console.error('❌ Thread failed:', error);
      process.exit(1);
    }
    process.exit(0);
  });

// Scrape posts command
program
  .command('scrape-posts')
  .description('Scrape posts from current page')
  .option('-m, --max <number>', 'Maximum posts to scrape', '10')
  .action(async (options: { max: string }) => {
    try {
      const page = await ensureAuthenticated();
      const posts = await scrapePosts(page, { maxPosts: parseInt(options.max) });
      console.log(`✅ Scraped ${posts.length} posts:`);
      posts.forEach((post, i) => {
        console.log(`\n${i + 1}. @${post.author.username}`);
        console.log(`   ${post.content.substring(0, 100)}...`);
        console.log(`   ❤️  ${post.metrics.likesCount} | 🔁 ${post.metrics.retweetsCount} | 📊 ${post.engagementRate.toFixed(2)}%`);
        console.log(`   🔗 ${post.url}`);
      });
    } catch (error) {
      console.error('❌ Scraping failed:', error);
      process.exit(1);
    }
    process.exit(0);
  });

// Scrape profile command
program
  .command('scrape-profile <username>')
  .description('Scrape a user profile')
  .option('-m, --max <number>', 'Maximum posts to include', '5')
  .action(async (username: string, options: { max: string }) => {
    try {
      const page = await ensureAuthenticated();
      const profile = await scrapeProfile(page, username, { maxPosts: parseInt(options.max) });
      if (!profile) {
        console.error(`❌ Could not find profile for @${username}`);
        process.exit(1);
      }
      console.log(`✅ Profile @${profile.username}:`);
      console.log(`   Name: ${profile.displayName}`);
      console.log(`   Bio: ${profile.bio}`);
      console.log(`   Followers: ${profile.followersCount}`);
      console.log(`   Following: ${profile.followingCount}`);
      console.log(`   Posts: ${profile.postsCount}`);
      console.log(`   Verified: ${profile.isVerified ? '✓' : '✗'}`);
      if (profile.latestPosts && profile.latestPosts.length > 0) {
        console.log(`\n   Latest posts:`);
        profile.latestPosts.forEach((post, i) => {
          console.log(`   ${i + 1}. ${post.content.substring(0, 80)}...`);
          console.log(`      ❤️  ${post.metrics.likesCount} | 🔁 ${post.metrics.retweetsCount}`);
        });
      }
    } catch (error) {
      console.error('❌ Profile scraping failed:', error);
      process.exit(1);
    }
    process.exit(0);
  });

// Scrape comments command
program
  .command('scrape-comments <postUrl>')
  .description('Scrape comments from a post')
  .option('-m, --max <number>', 'Maximum comments to scrape', '20')
  .action(async (postUrl: string, options: { max: string }) => {
    try {
      const page = await ensureAuthenticated();
      const comments = await scrapeComments(page, postUrl, { maxPosts: parseInt(options.max) });
      const topComments = getTopComments(comments, 5);
      console.log(`✅ Scraped ${comments.length} comments:`);
      console.log('\nTop comments:');
      topComments.forEach((comment, i) => {
        console.log(`\n${i + 1}. @${comment.author.username}`);
        console.log(`   ${comment.content}`);
        console.log(`   ❤️  ${comment.likesCount} | 💬 ${comment.repliesCount}`);
      });
    } catch (error) {
      console.error('❌ Comment scraping failed:', error);
      process.exit(1);
    }
    process.exit(0);
  });

// Search command
program
  .command('search <query>')
  .description('Search for tweets')
  .option('-m, --max <number>', 'Maximum posts to return', '10')
  .action(async (query: string, options: { max: string }) => {
    try {
      const page = await ensureAuthenticated();
      const posts = await searchTwitter(page, { query }, { maxPosts: parseInt(options.max) });
      console.log(`✅ Found ${posts.length} posts for "${query}":`);
      posts.forEach((post, i) => {
        console.log(`\n${i + 1}. @${post.author.username}`);
        console.log(`   ${post.content.substring(0, 100)}...`);
        console.log(`   ❤️  ${post.metrics.likesCount} | 🔁 ${post.metrics.retweetsCount} | 📊 ${post.engagementRate.toFixed(2)}%`);
        console.log(`   🔗 ${post.url}`);
      });
    } catch (error) {
      console.error('❌ Search failed:', error);
      process.exit(1);
    }
    process.exit(0);
  });

// Search viral command
program
  .command('search-viral <query>')
  .description('Search for viral posts')
  .option('-l, --min-likes <number>', 'Minimum likes for viral posts', '1000')
  .option('-m, --max <number>', 'Maximum posts to return', '10')
  .action(async (query: string, options: { minLikes: string; max: string }) => {
    try {
      const page = await ensureAuthenticated();
      const posts = await searchTwitter(
        page,
        SearchPresets.viral(query, parseInt(options.minLikes)),
        { maxPosts: parseInt(options.max) }
      );
      console.log(`✅ Found ${posts.length} viral posts for "${query}" (min ${options.minLikes} likes):`);
      posts.forEach((post, i) => {
        console.log(`\n${i + 1}. @${post.author.username}`);
        console.log(`   ${post.content.substring(0, 100)}...`);
        console.log(`   ❤️  ${post.metrics.likesCount} | 🔁 ${post.metrics.retweetsCount} | 📊 ${post.engagementRate.toFixed(2)}%`);
        console.log(`   🔗 ${post.url}`);
      });
    } catch (error) {
      console.error('❌ Viral search failed:', error);
      process.exit(1);
    }
    process.exit(0);
  });

// Scrape timeline command
program
  .command('scrape-timeline')
  .description('Scrape posts from timeline')
  .option('-t, --type <type>', 'Timeline type (for-you|following)', 'for-you')
  .option('-m, --max <number>', 'Maximum posts to scrape', '10')
  .action(async (options: { type: string; max: string }) => {
    try {
      const page = await ensureAuthenticated();
      const posts = await scrapeTimeline(page, options.type as any, { maxPosts: parseInt(options.max) });
      const avgEngagement = posts.reduce((sum, post) => sum + post.engagementRate, 0) / posts.length;
      console.log(`✅ Scraped ${posts.length} posts from ${options.type} timeline:`);
      console.log(`   Average engagement: ${avgEngagement.toFixed(2)}%`);
      posts.forEach((post, i) => {
        console.log(`\n${i + 1}. @${post.author.username}`);
        console.log(`   ${post.content.substring(0, 100)}...`);
        console.log(`   ❤️  ${post.metrics.likesCount} | 🔁 ${post.metrics.retweetsCount} | 📊 ${post.engagementRate.toFixed(2)}%`);
      });
    } catch (error) {
      console.error('❌ Timeline scraping failed:', error);
      process.exit(1);
    }
    process.exit(0);
  });

// Scrape trending command
program
  .command('scrape-trending')
  .description('Get trending topics')
  .action(async () => {
    try {
      const page = await ensureAuthenticated();
      const trends = await scrapeTrendingTopics(page);
      console.log(`✅ Trending topics:`);
      trends.forEach((trend, i) => {
        console.log(`${i + 1}. ${trend}`);
      });
    } catch (error) {
      console.error('❌ Trending scraping failed:', error);
      process.exit(1);
    }
    process.exit(0);
  });

// Like post command
program
  .command('like-post <postUrl>')
  .description('Like a specific post')
  .action(async (postUrl: string) => {
    try {
      const page = await ensureAuthenticated();
      const success = await likePost(page, postUrl);
      console.log(success ? `✅ Successfully liked post: ${postUrl}` : `ℹ️  Post was already liked: ${postUrl}`);
    } catch (error) {
      console.error('❌ Like failed:', error);
      process.exit(1);
    }
    process.exit(0);
  });

// Unlike post command
program
  .command('unlike-post <postUrl>')
  .description('Unlike a specific post')
  .action(async (postUrl: string) => {
    try {
      const page = await ensureAuthenticated();
      const success = await unlikePost(page, postUrl);
      console.log(success ? `✅ Successfully unliked post: ${postUrl}` : `ℹ️  Post was not liked: ${postUrl}`);
    } catch (error) {
      console.error('❌ Unlike failed:', error);
      process.exit(1);
    }
    process.exit(0);
  });

// Bookmark post command
program
  .command('bookmark-post <postUrl>')
  .description('Bookmark a specific post')
  .action(async (postUrl: string) => {
    try {
      const page = await ensureAuthenticated();
      await bookmarkPost(page, postUrl);
      console.log(`✅ Successfully bookmarked post: ${postUrl}`);
    } catch (error) {
      console.error('❌ Bookmark failed:', error);
      process.exit(1);
    }
    process.exit(0);
  });

// Unbookmark post command
program
  .command('unbookmark-post <postUrl>')
  .description('Remove bookmark from a specific post')
  .action(async (postUrl: string) => {
    try {
      const page = await ensureAuthenticated();
      await unbookmarkPost(page, postUrl);
      console.log(`✅ Successfully removed bookmark from post: ${postUrl}`);
    } catch (error) {
      console.error('❌ Unbookmark failed:', error);
      process.exit(1);
    }
    process.exit(0);
  });

// Retweet post command
program
  .command('retweet-post <postUrl>')
  .description('Retweet/repost a specific post')
  .action(async (postUrl: string) => {
    try {
      const page = await ensureAuthenticated();
      await retweetPost(page, postUrl);
      console.log(`✅ Successfully retweeted post: ${postUrl}`);
    } catch (error) {
      console.error('❌ Retweet failed:', error);
      process.exit(1);
    }
    process.exit(0);
  });

// Unretweet post command
program
  .command('unretweet-post <postUrl>')
  .description('Remove retweet/repost of a specific post')
  .action(async (postUrl: string) => {
    try {
      const page = await ensureAuthenticated();
      await unretweetPost(page, postUrl);
      console.log(`✅ Successfully unretweeted post: ${postUrl}`);
    } catch (error) {
      console.error('❌ Unretweet failed:', error);
      process.exit(1);
    }
    process.exit(0);
  });

// Quote tweet command
program
  .command('quote-tweet <postUrl>')
  .description('Quote tweet a post')
  .requiredOption('-t, --text <text>', 'Quote tweet text')
  .action(async (postUrl: string, options: { text: string }) => {
    try {
      const page = await ensureAuthenticated();
      await quoteTweet(page, postUrl, options.text);
      console.log(`✅ Successfully quote tweeted: "${options.text}" on post ${postUrl}`);
    } catch (error) {
      console.error('❌ Quote tweet failed:', error);
      process.exit(1);
    }
    process.exit(0);
  });

// Reply to post command
program
  .command('reply-to-post <postUrl>')
  .description('Reply to a post')
  .requiredOption('-t, --text <text>', 'Reply text')
  .action(async (postUrl: string, options: { text: string }) => {
    try {
      const page = await ensureAuthenticated();
      await replyToPost(page, postUrl, options.text);
      console.log(`✅ Successfully replied to post ${postUrl} with: "${options.text}"`);
    } catch (error) {
      console.error('❌ Reply failed:', error);
      process.exit(1);
    }
    process.exit(0);
  });

// Like comment by ID command
program
  .command('like-comment-by-id <commentUrl>')
  .description('Like a comment by its direct URL')
  .action(async (commentUrl: string) => {
    try {
      const page = await ensureAuthenticated();
      await likeCommentById(page, commentUrl);
      console.log(`✅ Successfully liked comment: ${commentUrl}`);
    } catch (error) {
      console.error('❌ Like comment by ID failed:', error);
      process.exit(1);
    }
    process.exit(0);
  });

// Unlike comment by ID command
program
  .command('unlike-comment-by-id <commentUrl>')
  .description('Unlike a comment by its direct URL')
  .action(async (commentUrl: string) => {
    try {
      const page = await ensureAuthenticated();
      await unlikeCommentById(page, commentUrl);
      console.log(`✅ Successfully unliked comment: ${commentUrl}`);
    } catch (error) {
      console.error('❌ Unlike comment by ID failed:', error);
      process.exit(1);
    }
    process.exit(0);
  });

// Reply to comment by ID command
program
  .command('reply-to-comment-by-id <commentUrl>')
  .description('Reply to a comment by its direct URL')
  .requiredOption('-t, --text <text>', 'Reply text')
  .action(async (commentUrl: string, options: { text: string }) => {
    try {
      const page = await ensureAuthenticated();
      await replyToCommentById(page, commentUrl, options.text);
      console.log(`✅ Successfully replied to comment ${commentUrl} with: "${options.text}"`);
    } catch (error) {
      console.error('❌ Reply to comment by ID failed:', error);
      process.exit(1);
    }
    process.exit(0);
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
} 