import React from 'react';
import { Shirt, Footprints, Shield } from 'lucide-react';

export const renderStitchGarmentIcon = (garmentName: string) => {
  const lower = garmentName.toLowerCase();

  // Pants, Jeans, Capri, Pyjama, Trousers, Track Pant, Sweat Pants
  if (
    lower.includes('pant') ||
    lower.includes('jean') ||
    lower.includes('capri') ||
    lower.includes('pyjama') ||
    lower.includes('trous')
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 4h10v6l-2 10h-2.5l-0.5-6-0.5 6H9L7 10V4z" />
      </svg>
    );
  }

  // Dhoti
  if (lower.includes('dhoti')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 4h10l-1.5 16H8.5L7 4z" />
        <path d="M12 4v16" />
      </svg>
    );
  }

  // Leather Jacket / Suede Leather Jacket -> Shield icon (matching Stitch reference)
  if (lower.includes('leather')) {
    return <Shield size={20} strokeWidth={1.5} />;
  }

  // Achkan, Sherwani (Traditional Indian Heavy Outerwear)
  if (lower.includes('achkan') || lower.includes('sherwani')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="5" r="2" />
        <path d="M8 9h8l1 11H7L8 9z" />
        <path d="M12 9v11" />
      </svg>
    );
  }

  // Kurta (Men), Kurta Heavy
  if (lower.includes('kurta')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 3h6l3 4-2.5 1.5v12.5H8.5V8.5L6 7l3-4z" />
        <path d="M12 3v7" />
      </svg>
    );
  }

  // Coat, Suit (2 Piece), Safari Suit Coat
  if (lower.includes('suit') || (lower.includes('coat') && !lower.includes('long coat'))) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 4h12l1.5 6-2 10H6.5L4.5 10 6 4z" />
        <path d="M6 4l6 7 6-7" />
        <path d="M12 11v9" />
      </svg>
    );
  }

  // Long Coat / Trench
  if (lower.includes('long coat')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 2h10l2 5-2 15H7L5 7l2-5z" />
        <path d="M7 2l5 6 5-6" />
        <path d="M12 8v14" />
      </svg>
    );
  }

  // Jacket With Hood, Sweat Shirt With Hood
  if (lower.includes('hood')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 2a3 3 0 00-3 3v2l-3 3 2 2v9h12v-9l2-2-3-3V5a3 3 0 00-3-3h-4z" />
        <path d="M10 2a2 2 0 014 0v4h-4V2z" />
      </svg>
    );
  }

  // Jacket Half Sleeves / Vest
  if (lower.includes('half sleeve') || lower.includes('vest')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 4h8l2 5-3 1v10H9V10L6 9l2-5z" />
        <path d="M9 4a3 3 0 006 0" />
      </svg>
    );
  }

  // Jacket Full Sleeves, Sweat Shirt
  if (lower.includes('full sleeve') || lower.includes('sweat shirt')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 4h8l3 4-2 3-1-1v10H8V10L7 11 5 8l3-4z" />
        <path d="M9 4a3 3 0 006 0" />
      </svg>
    );
  }

  // Pullover / Sweater
  if (lower.includes('pullover') || lower.includes('sweater')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 4h12l3 5-3 2v10H6V11L3 9l3-5z" />
        <path d="M8 4a4 4 0 008 0" />
        <path d="M6 18h12" />
      </svg>
    );
  }

  // Shoes
  if (
    lower.includes('shoe') ||
    lower.includes('sandal') ||
    lower.includes('slipper') ||
    lower.includes('boot')
  ) {
    return <Footprints size={20} strokeWidth={1.5} />;
  }

  // Default: Shirt icon
  return <Shirt size={20} strokeWidth={1.5} />;
};
