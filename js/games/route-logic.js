/**
 * Route/Connect Game - Pure Logic Module
 * 
 * Handles route-finding game logic without any DOM/map dependencies.
 * Can be used by both standalone game and Daily Challenge.
 */

export class RouteGameLogic {
  constructor({ neighbors, onAnswer, onComplete, singleRound = false }) {
    this.neighbors = neighbors;
    this.singleRound = singleRound;
    this.onAnswer = onAnswer;
    this.onComplete = onComplete;
    
    this.startCountry = null;
    this.endCountry = null;
    this.route = [];
    this.optimalPath = [];
    this.par = 0;
    this.hintsUsed = 0;
    this.maxHints = 3;
    this.roundEnded = false;
    this.startTime = null;
  }

  setRoute(startCountry, endCountry) {
    this.startCountry = startCountry;
    this.endCountry = endCountry;
    this.route = [startCountry];
    this.roundEnded = false;
    this.hintsUsed = 0;
    
    // Calculate optimal path and par
    this.optimalPath = this.findShortestPath(startCountry, endCountry);
    this.par = this.optimalPath ? this.optimalPath.length - 1 : 999;
    
    this.startTime = Date.now();
    
    return {
      start: startCountry,
      end: endCountry,
      par: this.par,
      optimalPath: this.optimalPath
    };
  }

  /**
   * BFS to find shortest path between two countries
   */
  findShortestPath(start, end) {
    if (start === end) return [start];
    
    const queue = [[start]];
    const visited = new Set([start]);
    
    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];
      const currentNeighbors = this.neighbors[current] || [];
      
      for (const neighbor of currentNeighbors) {
        if (neighbor === end) {
          return [...path, end];
        }
        
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }
    
    return null; // No path found
  }

  /**
   * Get valid neighbors for current position
   */
  getValidNeighbors() {
    if (this.route.length === 0) return [];
    const current = this.route[this.route.length - 1];
    const currentNeighbors = this.neighbors[current] || [];
    
    // Filter out countries already in route (no backtracking)
    return currentNeighbors.filter(n => !this.route.includes(n));
  }

  /**
   * Check if a country can be added to the route
   */
  canAddCountry(country) {
    const validNeighbors = this.getValidNeighbors();
    return validNeighbors.includes(country);
  }

  /**
   * Add a country to the route
   * Returns result object
   */
  addCountry(country) {
    if (this.roundEnded) {
      return { action: 'ignore' };
    }

    const validNeighbors = this.getValidNeighbors();
    
    if (!validNeighbors.includes(country)) {
      return {
        action: 'invalid',
        message: `${country} is not a neighbor of ${this.route[this.route.length - 1]}`
      };
    }

    this.route.push(country);

    // Check if the added country is a neighbor of the destination
    const countryNeighbors = this.neighbors[country] || [];
    if (countryNeighbors.includes(this.endCountry)) {
      // Auto-complete: add destination to route
      this.route.push(this.endCountry);
      this.roundEnded = true;
      const timeTaken = (Date.now() - this.startTime) / 1000;
      const steps = this.route.length - 1;
      const parDiff = steps - this.par;

      const result = {
        action: 'complete',
        route: [...this.route],
        steps,
        par: this.par,
        parDiff,
        optimalPath: this.optimalPath,
        time: timeTaken,
        hintsUsed: this.hintsUsed
      };

      if (this.onComplete) {
        this.onComplete(result);
      }

      return result;
    }

    return {
      action: 'added',
      country,
      route: [...this.route],
      steps: this.route.length - 1
    };
  }

  /**
   * Undo last country added
   */
  undo() {
    if (this.route.length <= 1) {
      return { action: 'cannot_undo' };
    }

    const removed = this.route.pop();
    return {
      action: 'undone',
      removed,
      route: [...this.route]
    };
  }

  /**
   * Get hint (next optimal step)
   */
  getHint() {
    if (this.hintsUsed >= this.maxHints) {
      return { action: 'no_hints_left' };
    }

    if (!this.optimalPath || this.route.length >= this.optimalPath.length) {
      return { action: 'no_hint_available' };
    }

    this.hintsUsed++;
    
    // Find where current route diverges from optimal
    let divergeIndex = 0;
    for (let i = 0; i < Math.min(this.route.length, this.optimalPath.length); i++) {
      if (this.route[i] !== this.optimalPath[i]) {
        break;
      }
      divergeIndex = i;
    }

    // If on optimal path, show next step
    if (divergeIndex === this.route.length - 1 && divergeIndex < this.optimalPath.length - 1) {
      const nextCountry = this.optimalPath[divergeIndex + 1];
      return {
        action: 'hint',
        country: nextCountry,
        message: `Hint ${this.hintsUsed}/${this.maxHints}: Try ${nextCountry}`,
        hintsRemaining: this.maxHints - this.hintsUsed
      };
    }

    // If diverged, suggest getting back on optimal path
    return {
      action: 'hint',
      message: `Hint ${this.hintsUsed}/${this.maxHints}: You're off the optimal path. Try undoing.`,
      hintsRemaining: this.maxHints - this.hintsUsed
    };
  }

  /**
   * Give up and show solution
   */
  giveUp() {
    if (this.roundEnded) {
      return { action: 'ignore' };
    }

    this.roundEnded = true;
    const timeTaken = (Date.now() - this.startTime) / 1000;

    const result = {
      action: 'gave_up',
      route: [...this.route],
      optimalPath: this.optimalPath,
      par: this.par,
      time: timeTaken,
      hintsUsed: this.hintsUsed
    };

    if (this.onComplete) {
      this.onComplete(result);
    }

    return result;
  }

  handleTimeout() {
    return this.giveUp();
  }

  getProgress() {
    return {
      route: [...this.route],
      steps: this.route.length - 1,
      par: this.par,
      hintsUsed: this.hintsUsed,
      hintsRemaining: this.maxHints - this.hintsUsed
    };
  }

  getOptimalPath() {
    return this.optimalPath;
  }
}
