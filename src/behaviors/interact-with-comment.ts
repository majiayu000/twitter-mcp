import { Page } from "playwright";
import { r } from "../utils";

/**
 * Utility function to find the focal comment on a comment page
 * @param page - The authenticated page
 * @returns Locator for the focal comment
 */
async function findFocalComment(page: Page) {
  // Wait for the focal/main comment to load
  await page.waitForTimeout(r(1000, 1500));
  
  // The focal comment is typically marked with specific attributes or is in a specific container
  // Try multiple strategies to find the right comment
  const focalComment = page.locator('article[tabindex="-1"]').or(
    page.locator('[data-testid="tweet"][tabindex="-1"]')
  ).or(
    // Sometimes the focal comment is the last article in the main thread
    page.locator('article').filter({ hasText: /^(?!.*Show this thread).*$/ }).last()
  );
  
  return focalComment;
}

/**
 * Like a comment by its ID (if you have scraped comments and have their IDs)
 * @param page - The authenticated page
 * @param commentUrl - Direct URL to the comment
 */
export async function likeCommentById(page: Page, commentUrl: string): Promise<boolean> {
  try {
    await page.goto(commentUrl);
    await page.waitForLoadState('domcontentloaded');
    
    // Find the focal comment
    const focalComment = await findFocalComment(page);
    
    // Find the like button within the focal comment
    const likeButton = focalComment.locator('[data-testid="like"]').first();
    
    if (await likeButton.isVisible()) {
      await likeButton.click();
      await page.waitForTimeout(r(500, 800));
      return true;
    } else {
      throw new Error("Like button not found in the focal comment");
    }
    
  } catch (error) {
    console.error("Error liking comment by ID:", error);
    throw error;
  }
}

/**
 * Unlike a comment by its ID (if you have scraped comments and have their IDs)
 * @param page - The authenticated page
 * @param commentUrl - Direct URL to the comment
 */
export async function unlikeCommentById(page: Page, commentUrl: string): Promise<boolean> {
  try {
    await page.goto(commentUrl);
    await page.waitForLoadState('domcontentloaded');
    
    // Find the focal comment
    const focalComment = await findFocalComment(page);
    
    // Find the unlike button within the focal comment
    const unlikeButton = focalComment.locator('[data-testid="unlike"]').first();
    
    if (await unlikeButton.isVisible()) {
      await unlikeButton.click();
      await page.waitForTimeout(r(500, 800));
      return true;
    } else {
      throw new Error("Unlike button not found in the focal comment");
    }
    
  } catch (error) {
    console.error("Error unliking comment by ID:", error);
    throw error;
  }
}

/**
 * Reply to a comment by its ID (if you have scraped comments and have their IDs)
 * @param page - The authenticated page
 * @param commentUrl - Direct URL to the comment
 * @param replyText - The text to reply with
 */
export async function replyToCommentById(page: Page, commentUrl: string, replyText: string): Promise<boolean> {
  try {
    await page.goto(commentUrl);
    await page.waitForLoadState('domcontentloaded');
    
    // Find the focal comment
    const focalComment = await findFocalComment(page);
    
    // Find the reply button within the focal comment
    const replyButton = focalComment.locator('[data-testid="reply"]').first();
    
    if (await replyButton.isVisible()) {
      await replyButton.click();
      
      // Wait for reply compose area
      await page.waitForSelector('[data-testid="tweetTextarea_0"]');
      
      // Type the reply
      const textArea = page.locator('[data-testid="tweetTextarea_0"]');
      await textArea.fill(replyText);
      await page.waitForTimeout(r(300, 500));
      
      // Click reply button
      const tweetButton = page.locator('[data-testid="tweetButton"]');
      await tweetButton.click();
      await page.waitForTimeout(r(1000, 1500));
      
      return true;
    } else {
      throw new Error("Reply button not found in the focal comment");
    }
    
  } catch (error) {
    console.error("Error replying to comment by ID:", error);
    throw error;
  }
}