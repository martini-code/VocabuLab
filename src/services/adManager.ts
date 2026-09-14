/**
 * Manages full-screen interstitial advertisement triggers for free users.
 * Triggers full screen ads when users complete study sessions or reach review milestones.
 */

class AdManager {
  private reviewsSinceLastAd: number = 0;
  private readonly REVIEWS_PER_AD = 8;

  /**
   * Records a card review and returns true if an ad threshold has been reached.
   */
  recordCardReview(): boolean {
    this.reviewsSinceLastAd++;
    return this.reviewsSinceLastAd >= this.REVIEWS_PER_AD;
  }

  /**
   * Checks if an ad should be displayed upon session completion.
   */
  shouldShowAdOnSessionComplete(): boolean {
    // Show full-screen ad if the user has completed at least 2 reviews in this session
    return this.reviewsSinceLastAd >= 2;
  }

  /**
   * Resets the counter after an ad is shown or dismissed.
   */
  resetCounter(): void {
    this.reviewsSinceLastAd = 0;
  }

  getPendingReviewCount(): number {
    return this.reviewsSinceLastAd;
  }
}

export const adManager = new AdManager();
