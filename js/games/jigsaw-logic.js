/**
 * Map Jigsaw — Pure game logic (no DOM)
 *
 * Tracks pieces, placement checks, scoring, and timing.
 */

export class JigsawLogic {
  /**
   * @param {Array<{country: string, centroidX: number, centroidY: number}>} pieces
   */
  constructor(pieces) {
    this.pieces = pieces.map((p, i) => ({
      ...p,
      index: i,
      placed: false,
      firstAttempt: true,
    }));
    this.score = 0;
    this.startTime = null;
  }

  reset() {
    this.score = 0;
    this.startTime = Date.now();
    for (const p of this.pieces) {
      p.placed = false;
      p.firstAttempt = true;
    }
  }

  /**
   * Check whether a drop position is close enough to the correct centroid.
   * @param {number} index - piece index
   * @param {number} dropX - drop X in SVG map coords
   * @param {number} dropY - drop Y in SVG map coords
   * @param {number} threshold - max distance for a snap
   * @returns {{ correct: boolean, snapX: number, snapY: number }}
   */
  /**
   * Check distance without penalizing — used during drag for auto-snap.
   */
  isWithinThreshold(index, dropX, dropY, threshold) {
    const piece = this.pieces[index];
    const dx = dropX - piece.centroidX;
    const dy = dropY - piece.centroidY;
    return Math.sqrt(dx * dx + dy * dy) <= threshold;
  }

  checkPlacement(index, dropX, dropY, threshold) {
    const piece = this.pieces[index];
    const dx = dropX - piece.centroidX;
    const dy = dropY - piece.centroidY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const correct = dist <= threshold;

    if (!correct) {
      piece.firstAttempt = false;
    }

    return { correct, snapX: piece.centroidX, snapY: piece.centroidY };
  }

  markPlaced(index, hintsVisible) {
    const piece = this.pieces[index];
    piece.placed = true;
    if (piece.firstAttempt && !hintsVisible) this.score += 2;
    else if (piece.firstAttempt || !hintsVisible) this.score += 1;
  }

  isComplete() {
    return this.pieces.every(p => p.placed);
  }

  getProgress() {
    const placed = this.pieces.filter(p => p.placed).length;
    return { placed, total: this.pieces.length, maxScore: this.pieces.length * 2, score: this.score };
  }

  getAccuracy() {
    const max = this.pieces.length * 2;
    if (max === 0) return 100;
    return Math.round((this.score / max) * 100);
  }

  getElapsedSeconds() {
    if (!this.startTime) return 0;
    return Math.round((Date.now() - this.startTime) / 1000);
  }
}
