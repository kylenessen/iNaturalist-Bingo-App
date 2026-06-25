import { ICONIC_TAXA, MONTH_NAMES } from "./config.js";

function pad2(value) {
  return String(value).padStart(2, "0");
}

export function formatMetadataDate(date) {
  const safeDate =
    date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();

  return [
    safeDate.getFullYear(),
    pad2(safeDate.getMonth() + 1),
    pad2(safeDate.getDate()),
  ].join("-") + " " + [
    pad2(safeDate.getHours()),
    pad2(safeDate.getMinutes()),
  ].join(":");
}

function getMonthLabels(selectedMonths) {
  return (selectedMonths || [])
    .map((month) => MONTH_NAMES[Number(month) - 1])
    .filter(Boolean);
}

function getTaxaLabels(selectedIconicTaxa) {
  return (selectedIconicTaxa || []).map((taxon) => ICONIC_TAXA[taxon] || taxon);
}

function formatFilters(selectedMonths, selectedIconicTaxa) {
  const filters = [];
  const monthLabels = getMonthLabels(selectedMonths);
  const taxaLabels = getTaxaLabels(selectedIconicTaxa);

  if (monthLabels.length > 0) {
    filters.push(`months ${monthLabels.join(", ")}`);
  }

  if (taxaLabels.length > 0) {
    filters.push(`categories ${taxaLabels.join(", ")}`);
  }

  return filters.length > 0 ? filters.join(", ") : "none";
}

function formatPlace(placeName, placeId) {
  if (placeName && placeId) return `${placeName} (ID ${placeId})`;
  if (placeName) return placeName;
  if (placeId) return `ID ${placeId}`;
  return "unknown";
}

export function buildMetadataFooter({
  createdAt,
  placeName,
  placeId,
  gridSize,
  numCards,
  speciesPoolSize,
  freeSquare,
  selectedMonths,
  selectedIconicTaxa,
  baseSeed,
}) {
  const parts = [
    `Created ${formatMetadataDate(createdAt)}`,
    `Place ${formatPlace(placeName, placeId)}`,
    `Grid ${gridSize} x ${gridSize}`,
    `Cards ${numCards}`,
    `Species pool ${speciesPoolSize}`,
    `Free square ${freeSquare ? "on" : "off"}`,
    `Filters ${formatFilters(selectedMonths, selectedIconicTaxa)}`,
  ];

  if (baseSeed !== null && baseSeed !== undefined) {
    parts.push(`Seed ${baseSeed}`);
  }

  return parts.join(" | ");
}
