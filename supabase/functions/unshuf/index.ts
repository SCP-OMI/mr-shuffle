// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
import seedrandom from 'https://cdn.skypack.dev/seedrandom';
import { createCanvas, loadImage } from "https://deno.land/x/canvas/mod.ts";

interface Square {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

interface Group {
  slices: number;
  cols: number;
  rows: number;
  x: number;
  y: number;
}

function toNumber(input: any): number {
  if (typeof input === "number") {
    return input;
  }
  if (typeof input === "symbol") {
    return NaN;
  }
  if (typeof input === "object") {
    input = typeof input.valueOf === "function" ? input.valueOf() : input;
    input = typeof input === "object" ? String(input) : input;
  }
  if (typeof input !== "string") {
    return input === 0 ? input : Number(input);
  }
  input = input.replace(/^\s+|\s+$/g, "");
  const isBinary = /^0b[01]+$/i.test(input);
  if (isBinary || /^0o[0-7]+$/i.test(input)) {
    return parseInt(input.slice(2), isBinary ? 2 : 8);
  }
  return /^[-+]0x[0-9a-f]+$/i.test(input) ? NaN : Number(input);
}

function createRange(start: number, end?: number, step?: number): number[] {
  start = start ? toNumber(start) : 0;
  if (end === undefined) {
    end = start;
    start = 0;
  } else {
    end = toNumber(end);
  }
  step = step === undefined ? (start < end ? 1 : -1) : toNumber(step);
  return baseRange(start, end, step, false);
}

function baseRange(
  start: number,
  end: number,
  step: number,
  fromRight: boolean
): number[] {
  let index = -1;
  let length = Math.max(Math.ceil((end - start) / (step || 1)), 0);
  const result = new Array(length);
  while (length--) {
    result[fromRight ? length : ++index] = start;
    start += step;
  }
  return result;
}

function getGroup(group: Square[]): Group {
  const result: Group = {
    slices: group.length,
    cols: getColsInGroup(group),
    rows: 0,
    x: group[0].x,
    y: group[0].y,
  };
  result.rows = group.length / result.cols;
  return result;
}

function getColsInGroup(group: Square[]): number {
  if (group.length === 1) {
    return 1;
  }
  let cols: number | undefined;
  let i: number;
  for (i = 0; i < group.length; i++) {
    if ((cols = cols === undefined ? group[i].y : cols) !== group[i].y) {
      return i;
    }
  }
  return i;
}

function unShuffle(array: any[], seed: string): any[] | null {
  if (!Array.isArray(array)) {
    return null;
  }

  const arrayLength = array.length;
  const randomGenerator = seedrandom(seed);
  const shuffledArray = [];
  const indexArray = [];
  for (let i = 0; i < arrayLength; i++) {
    shuffledArray.push(null);
    indexArray.push(i);
  }
  for (let i = 0; i < arrayLength; i++) {
    const randomIndex =
      Math.floor(randomGenerator() * (indexArray.length - 1 - 0 + 1)) + 0;
    const index = indexArray[randomIndex];
    indexArray.splice(randomIndex, 1);
    shuffledArray[index] = array[i];
  }
  return shuffledArray;
}

async function imgReverser(imageSrcUrl: string, squareSideLength = 200, stringSeed = 'stay'): Promise<string | null> {
    const img = await loadImage(imageSrcUrl);
    const imageWidth = img.width();
    const imageHeight = img.height();
    const canvas = createCanvas(imageWidth, imageHeight);
    const context = canvas.getContext('2d');
    const totalSquares = Math.ceil(imageWidth / squareSideLength) * Math.ceil(imageHeight / squareSideLength);
    const squaresPerRow = Math.ceil(imageWidth / squareSideLength);
    const squareGroups: { [key: string]: any[] } = {};
    for (let i = 0; i < totalSquares; i++) {
        const row = Math.floor(i / squaresPerRow);
        let square: Square = {
            x: (i - row * squaresPerRow) * squareSideLength,
            y: row * squareSideLength,
        };
        square.width = squareSideLength - (square.x + squareSideLength <= imageWidth ? 0 : square.x + squareSideLength - imageWidth);
        square.height = squareSideLength - (square.y + squareSideLength <= imageHeight ? 0 : square.y + squareSideLength - imageHeight);
        if (!squareGroups[square.width + '-' + square.height]) {
            squareGroups[square.width + '-' + square.height] = [];
        }
        squareGroups[square.width + '-' + square.height].push(square);
    }
    for (const squareGroup in squareGroups) {
        const deshuffled = unShuffle(createRange(0, squareGroups[squareGroup].length), stringSeed);
        const group = getGroup(squareGroups[squareGroup]);
        for (const [index, square] of squareGroups[squareGroup].entries()) {
            let deltaX:number = deshuffled[index];
            let deltaY = Math.floor(deltaX / group.cols);
            deltaX = (deltaX - deltaY * group.cols) * square.width;
            deltaY = deltaY * square.height;
            context.drawImage(
                img,
                group.x + deltaX,
                group.y + deltaY,
                square.width,
                square.height,
                square.x,
                square.y,
                square.width,
                square.height);
        }
    }
    return canvas.toBuffer("image/png");
}


Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(
      "Bad request: Only POST method is allowed",
      { status: 400 },
    )
  }

  let body;
  try {
    body = await req.json();
  } catch (error) {
    return new Response(
      "Bad request: request body is not valid JSON",
      { status: 400 },
    )
  }

  const imgURL = body.imgURL;

  if (!imgURL) {
    return new Response(
      "Bad request: missing imgURL in request body",
      { status: 400 },
    )
  }

  console.log(imgURL.toString());

  const data = await imgReverser(imgURL, 200, 'stay');

  return new Response(
    data,
    { headers: { "Content-Type": "image/png" } },
  )
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/unshuf' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
