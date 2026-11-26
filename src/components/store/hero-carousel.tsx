"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const SLIDES = [
  "2baf0b1d-1e5d-4d22-b80c-3793919d4cd6.jpeg",
  "58167738-682b-4544-ae1b-f51e0204e752.jpeg",
  "65ae25b5-ba60-4df4-a41d-de07799ba4de.jpeg",
  "81f4a1fb-1b40-44e7-b345-09524e60c9a5.jpeg",
  "fcb80e88-70ea-4c4b-9f39-b9c4ac57844d.jpeg",
].map((f) => `/images/carousel/${f}`);

const INTERVAL_MS = 5000;

/** Crossfading background slideshow; decorative, so images have empty alt. */
export function HeroCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => (i + 1) % SLIDES.length),
      INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div className="absolute inset-0" aria-hidden="true">
      {SLIDES.map((src, i) => (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          sizes="100vw"
          priority={i === 0}
          className={`object-cover transition-opacity duration-1000 ease-in-out ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
    </div>
  );
}
