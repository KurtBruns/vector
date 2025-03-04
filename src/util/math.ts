import { Point } from '../model/Point'

/**
 * TAU represents the circle constant which is a full rotation in radians.
 */
export const TAU = 2 * Math.PI;

/**
 * Generates a linearly spaced array of numbers between a start and end value.
 *
 * @param {number} start - The starting value of the sequence.
 * @param {number} end - The ending value of the sequence.
 * @param {number} num - The number of elements in the resulting array.
 *                        If `num` is 1, the array will contain only the `start` value.
 *                        If `num` is greater than 1, the array will contain `num` equally spaced values between `start` and `end`.
 * @returns {number[]} An array of `num` values, starting from `start` and ending at `end`, spaced equally.
 */
export function linearSpace(start: number, end: number, num: number): number[] {
    const result: number[] = [];
    if (num === 1) {
        result.push(start);
    } else {
        const step = (end - start) / (num - 1);
        for (let i = 0; i < num; i++) {
            result.push(start + step * i);
        }
    }
    return result;
}

/**
 * Returns the factorial of n (not optimized)
 */
export function factorial(n: number) {

    if (n < 1) {
        return 1;
    } else {
        return n * this.factorial(n - 1);
    }
}

/**
* Returns the next prime number after the given integer.
*/
export function nextPrime(n: number) {
    if (!Number.isInteger(n)) {
        throw Error('Please pass an integer as a parameter');
    }

    // Search for the next prime until it is found
    while (!isPrime(++n)) {
    }
    return n;
}

/**
* Returns true if the number is prime, false otherwise.
*/
export function isPrime(n: number) {
    if (!Number.isInteger(n) || n <= 1) {
        return false;
    }

    // Check if any of the numbers, up to the square root of the number, evenly
    // divide the number
    for (let i = 2; i <= Math.sqrt(n); i++) {
        if (n % i == 0) {
            return false;
        }
    }
    return true;
}

/**
* Returns a floor with a radix
*/
export function floor(n: number, radix: number) {
    return n - (n % radix);
}

/**
* Returns the point where two lines intersect. The first line is defined by the
* points p1 and p2. The second line is defined by the points p3 and p4.
*/
export function pointWhereTwoLinesIntersect(p1: Point, p2: Point, p3: Point, p4: Point): Point {
    let slope1 = (p2.y - p1.y) / (p2.x - p1.x);
    let slope2 = (p4.y - p3.y) / (p4.x - p3.x);
    let b1 = (p2.y - p2.x * slope1);
    let b2 = (p4.y - p4.x * slope2);
    let x = (b2 - b1) / (slope1 - slope2);
    let y;
    if (!isFinite(slope1)) {
        x = p1.x;
        y = p3.y + slope2 * (x - p3.x);
    } else if (!isFinite(slope2)) {
        x = p3.x;
        y = p1.y + slope1 * (x - p1.x);
    } else {
        y = p1.y + slope1 * (x - p1.x);
    }
    return new Point(x, y);
}

/**
* This function generates a particular trapezoidal wave function. The wave starts
* at 0 and linearly increases to the amplitude of the wave in 1/6 the period. It
* stays at the amplitude for 1/3 the period, then decreases linearly to 0 in 1/6
* the period where it stays at 0 for the remaind period of 1/3.
*
* t - shifts the wave forwards or backwards (TODO: shifted too far right causes
* a bug where the waveform doesn't appear when it should)
* a - is the amplitude of the wave
* λ - is the period of the wave
*/
export function trapezoidalWave(t: number, a: number = 1, λ: number = 1) {
    return (x: number) => {

        x = Math.abs(x)

        // normalize x to always be in the range from 0 to λ
        x = (x - t) % λ;

        if (x < 0) {
            return 0;
        } else if (x < λ * 1 / 6) {
            return a * 6 * x / λ;
        } else if (x <= λ * 1 / 2) {
            return a;
        } else if (x < λ * 2 / 3) {
            return a * 4 - a * 6 * x / λ;
        } else {
            return 0;
        }
    }
}