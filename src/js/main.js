import "../scss/style.scss";

const coinsList = document.getElementById("coinsList");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const refreshBtn = document.getElementById("refreshBtn");
const statusBox = document.getElementById("statusBox");
const coinsCount = document.getElementById("coinsCount");
const favoritesCount = document.getElementById("favoritesCount");
const lastUpdate = document.getElementById("lastUpdate");
const filterButtons = document.querySelectorAll(".filter-btn");
const toastContainer = document.getElementById("toastContainer");
const cursorGlow = document.getElementById("cursorGlow");
const watchlist = document.getElementById("watchlist");
const tickerTrack = document.getElementById("tickerTrack");
const favoritesOnlyBtn = document.getElementById("favoritesOnlyBtn");
const scrollToCoinsBtn = document.getElementById("scrollToCoinsBtn");
const heroCard = document.getElementById("heroCard");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const layoutToggleBtn = document.getElementById("layoutToggleBtn");

const topGainerName = document.getElementById("topGainerName");
const topGainerValue = document.getElementById("topGainerValue");
const topGainerBar = document.getElementById("topGainerBar");

const topLoserName = document.getElementById("topLoserName");
const topLoserValue = document.getElementById("topLoserValue");
const topLoserBar = document.getElementById("topLoserBar");

const avgChangeValue = document.getElementById("avgChangeValue");
const avgChangeBar = document.getElementById("avgChangeBar");

const coinModal = document.getElementById("coinModal");
const modalBackdrop = document.getElementById("modalBackdrop");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalBody = document.getElementById("modalBody");

const compareSelectA = document.getElementById("compareSelectA");
const compareSelectB = document.getElementById("compareSelectB");
const compareResult = document.getElementById("compareResult");
const clearCompareBtn = document.getElementById("clearCompareBtn");

let allCoins = [];
let activeFilter = "all";
let favoritesOnly = false;
let layoutMode = localStorage.getItem("layoutMode") || "grid";
let currentTheme = localStorage.getItem("themeMode") || "dark";
let favorites = JSON.parse(localStorage.getItem("favoriteCoins")) || [];
let compareCoinA = "";
let compareCoinB = "";

document.body.dataset.theme = currentTheme;
coinsList.classList.toggle("coins-list--list", layoutMode === "list");

async function loadCoins() {
  try {
    showStatus("Завантаження даних...");
    renderSkeletons();
    setRefreshLoading(true);

    const response = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=24&page=1&sparkline=true&price_change_percentage=24h"
    );

    if (!response.ok) {
      throw new Error("Не вдалося отримати дані");
    }

    const data = await response.json();
    allCoins = data;

    updateDashboardStats();
    updateOverview();
    renderTicker();
    renderWatchlist();
    populateCompareSelectors();
    renderCompare();
    renderCoins(getProcessedCoins());
    showStatus("");
  } catch (error) {
    console.error(error);
    showStatus("Помилка при завантаженні даних. Спробуй ще раз.");
    coinsList.innerHTML = `
      <div class="empty-message glass">
        Не вдалося завантажити дані.
      </div>
    `;
  } finally {
    setRefreshLoading(false);
  }
}

function setRefreshLoading(isLoading) {
  refreshBtn.disabled = isLoading;
  refreshBtn.textContent = isLoading ? "Оновлення..." : "Оновити ринок";
}

function showStatus(message) {
  statusBox.textContent = message;
  statusBox.classList.toggle("visible", Boolean(message));
}

function updateDashboardStats() {
  coinsCount.textContent = allCoins.length;
  favoritesCount.textContent = favorites.length;

  const now = new Date();
  lastUpdate.textContent = now.toLocaleTimeString("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function updateOverview() {
  if (!allCoins.length) return;

  const byChange = [...allCoins].sort(
    (a, b) => (b.price_change_percentage_24h ?? 0) - (a.price_change_percentage_24h ?? 0)
  );

  const gainer = byChange[0];
  const loser = byChange[byChange.length - 1];
  const avg =
    allCoins.reduce((sum, coin) => sum + (coin.price_change_percentage_24h ?? 0), 0) /
    allCoins.length;

  topGainerName.textContent = gainer.name;
  topGainerValue.textContent = `+${(gainer.price_change_percentage_24h ?? 0).toFixed(2)}%`;
  topGainerBar.style.width = `${Math.min(Math.abs(gainer.price_change_percentage_24h ?? 0) * 6, 100)}%`;

  topLoserName.textContent = loser.name;
  topLoserValue.textContent = `${(loser.price_change_percentage_24h ?? 0).toFixed(2)}%`;
  topLoserBar.style.width = `${Math.min(Math.abs(loser.price_change_percentage_24h ?? 0) * 6, 100)}%`;

  avgChangeValue.textContent = `${avg >= 0 ? "+" : ""}${avg.toFixed(2)}%`;
  avgChangeBar.style.width = `${Math.min(Math.abs(avg) * 10, 100)}%`;
}

function saveFavorites() {
  localStorage.setItem("favoriteCoins", JSON.stringify(favorites));
  favoritesCount.textContent = favorites.length;
  renderWatchlist();
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("hide");
    setTimeout(() => toast.remove(), 350);
  }, 2200);
}

function toggleFavorite(coinId) {
  const coin = allCoins.find((item) => item.id === coinId);

  if (favorites.includes(coinId)) {
    favorites = favorites.filter((id) => id !== coinId);
    showToast(`${coin?.name ?? "Монету"} видалено з favorites`);
  } else {
    favorites.push(coinId);
    showToast(`${coin?.name ?? "Монету"} додано в favorites`);
  }

  saveFavorites();
  renderCoins(getProcessedCoins());
}

function formatMoney(value) {
  if (value >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return `$${Number(value).toLocaleString()}`;
}

function createSparklineSVG(prices, isPositive, big = false) {
  if (!prices || prices.length < 2) return "";

  const width = big ? 700 : 220;
  const height = big ? 220 : 72;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const points = prices
    .map((price, index) => {
      const x = (index / (prices.length - 1)) * width;
      const y = height - ((price - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const lineColor = isPositive ? "#9bff7a" : "#ff73c7";
  const gradientId = `grad-${Math.random().toString(36).slice(2, 9)}`;

  return `
    <svg viewBox="0 0 ${width} ${height}" class="${big ? "sparkline sparkline--big" : "sparkline"}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${lineColor}" stop-opacity="0.45" />
          <stop offset="100%" stop-color="${lineColor}" stop-opacity="1" />
        </linearGradient>
      </defs>

      <polyline
        fill="none"
        stroke="url(#${gradientId})"
        stroke-width="${big ? 5 : 3}"
        stroke-linecap="round"
        stroke-linejoin="round"
        points="${points}"
      />
    </svg>
  `;
}

function getProcessedCoins() {
  const searchValue = searchInput.value.toLowerCase().trim();
  const sortValue = sortSelect.value;

  let result = [...allCoins].filter((coin) => {
    const matchSearch =
      coin.name.toLowerCase().includes(searchValue) ||
      coin.symbol.toLowerCase().includes(searchValue);

    if (!matchSearch) return false;
    if (favoritesOnly && !favorites.includes(coin.id)) return false;
    if (activeFilter === "favorites") return favorites.includes(coin.id);
    if (activeFilter === "gainers") return (coin.price_change_percentage_24h ?? 0) > 0;
    if (activeFilter === "losers") return (coin.price_change_percentage_24h ?? 0) < 0;

    return true;
  });

  if (activeFilter === "gainers") {
    result.sort(
      (a, b) => (b.price_change_percentage_24h ?? 0) - (a.price_change_percentage_24h ?? 0)
    );
  }

  if (activeFilter === "losers") {
    result.sort(
      (a, b) => (a.price_change_percentage_24h ?? 0) - (b.price_change_percentage_24h ?? 0)
    );
  }

  if (sortValue === "price-desc") {
    result.sort((a, b) => b.current_price - a.current_price);
  } else if (sortValue === "price-asc") {
    result.sort((a, b) => a.current_price - b.current_price);
  } else if (sortValue === "marketcap-desc") {
    result.sort((a, b) => b.market_cap - a.market_cap);
  } else if (sortValue === "marketcap-asc") {
    result.sort((a, b) => a.market_cap - b.market_cap);
  } else if (sortValue === "change-desc") {
    result.sort(
      (a, b) => (b.price_change_percentage_24h ?? 0) - (a.price_change_percentage_24h ?? 0)
    );
  } else if (sortValue === "change-asc") {
    result.sort(
      (a, b) => (a.price_change_percentage_24h ?? 0) - (b.price_change_percentage_24h ?? 0)
    );
  } else if (sortValue === "rank-asc") {
    result.sort((a, b) => (a.market_cap_rank ?? 9999) - (b.market_cap_rank ?? 9999));
  }

  return result;
}

function renderSkeletons() {
  coinsList.innerHTML = "";

  for (let i = 0; i < 8; i += 1) {
    const skeleton = document.createElement("article");
    skeleton.className = "coin-card glass skeleton-card";
    skeleton.innerHTML = `
      <div class="skeleton skeleton--title"></div>
      <div class="skeleton skeleton--chart"></div>
      <div class="skeleton skeleton--line"></div>
      <div class="skeleton skeleton--line short"></div>
      <div class="skeleton skeleton--line"></div>
    `;
    coinsList.appendChild(skeleton);
  }
}

function renderTicker() {
  const items = allCoins
    .slice(0, 10)
    .map((coin) => {
      const change = coin.price_change_percentage_24h ?? 0;
      return `
        <div class="ticker-item">
          <span class="ticker-item__name">${coin.symbol.toUpperCase()}</span>
          <span class="ticker-item__price">$${coin.current_price.toLocaleString()}</span>
          <span class="ticker-item__change ${change >= 0 ? "positive-text" : "negative-text"}">
            ${change >= 0 ? "+" : ""}${change.toFixed(2)}%
          </span>
        </div>
      `;
    })
    .join("");

  tickerTrack.innerHTML = items + items;
}

function renderWatchlist() {
  watchlist.innerHTML = "";

  const watchlistCoins = allCoins.filter((coin) => favorites.includes(coin.id));

  if (!watchlistCoins.length) {
    watchlist.innerHTML = `
      <div class="watchlist-empty">
        Додай монети в favorites, щоб вони з'явились тут.
      </div>
    `;
    return;
  }

  watchlistCoins.forEach((coin) => {
    const item = document.createElement("button");
    item.className = "watchlist-item";
    item.innerHTML = `
      <div class="watchlist-item__left">
        <img src="${coin.image}" alt="${coin.name}" />
        <div>
          <strong>${coin.name}</strong>
          <span>${coin.symbol.toUpperCase()}</span>
        </div>
      </div>
      <div class="watchlist-item__right">
        <span>$${coin.current_price.toLocaleString()}</span>
      </div>
    `;

    item.addEventListener("click", () => openCoinModal(coin.id));
    watchlist.appendChild(item);
  });
}

function populateCompareSelectors() {
  const options = allCoins
    .map(
      (coin) =>
        `<option value="${coin.id}">${coin.name} (${coin.symbol.toUpperCase()})</option>`
    )
    .join("");

  compareSelectA.innerHTML = `<option value="">Перша монета</option>${options}`;
  compareSelectB.innerHTML = `<option value="">Друга монета</option>${options}`;

  compareSelectA.value = compareCoinA;
  compareSelectB.value = compareCoinB;
}

function renderCompare() {
  if (!compareCoinA || !compareCoinB || compareCoinA === compareCoinB) {
    compareResult.innerHTML = `
      <div class="compare-empty">
        Обери дві різні монети, щоб побачити порівняння.
      </div>
    `;
    return;
  }

  const coinA = allCoins.find((coin) => coin.id === compareCoinA);
  const coinB = allCoins.find((coin) => coin.id === compareCoinB);

  if (!coinA || !coinB) {
    compareResult.innerHTML = `<div class="compare-empty">Дані для compare недоступні.</div>`;
    return;
  }

  compareResult.innerHTML = `
    <div class="compare-table">
      <div class="compare-table__head">${coinA.name}</div>
      <div class="compare-table__head compare-table__metric">Метрика</div>
      <div class="compare-table__head">${coinB.name}</div>

      <div class="compare-cell">$${coinA.current_price.toLocaleString()}</div>
      <div class="compare-cell compare-table__metric">Ціна</div>
      <div class="compare-cell">$${coinB.current_price.toLocaleString()}</div>

      <div class="compare-cell">${formatMoney(coinA.market_cap)}</div>
      <div class="compare-cell compare-table__metric">Market Cap</div>
      <div class="compare-cell">${formatMoney(coinB.market_cap)}</div>

      <div class="compare-cell">${(coinA.price_change_percentage_24h ?? 0).toFixed(2)}%</div>
      <div class="compare-cell compare-table__metric">24h</div>
      <div class="compare-cell">${(coinB.price_change_percentage_24h ?? 0).toFixed(2)}%</div>

      <div class="compare-cell">${formatMoney(coinA.total_volume)}</div>
      <div class="compare-cell compare-table__metric">Volume</div>
      <div class="compare-cell">${formatMoney(coinB.total_volume)}</div>

      <div class="compare-cell">#${coinA.market_cap_rank ?? "-"}</div>
      <div class="compare-cell compare-table__metric">Rank</div>
      <div class="compare-cell">#${coinB.market_cap_rank ?? "-"}</div>
    </div>
  `;
}

function renderCoins(coins) {
  coinsList.innerHTML = "";

  if (!coins.length) {
    coinsList.innerHTML = `
      <div class="empty-message glass">
        Нічого не знайдено. Спробуй інший пошук або фільтр.
      </div>
    `;
    return;
  }

  coins.forEach((coin, index) => {
    const priceChange = coin.price_change_percentage_24h ?? 0;
    const changeClass = priceChange >= 0 ? "positive" : "negative";
    const sign = priceChange >= 0 ? "+" : "";
    const isPositive = priceChange >= 0;
    const sparklinePrices = coin.sparkline_in_7d?.price || [];
    const sparklineSVG = createSparklineSVG(sparklinePrices, isPositive);
    const isFavorite = favorites.includes(coin.id);

    const card = document.createElement("article");
    card.className = "coin-card glass tilt-card";
    card.style.animationDelay = `${index * 70}ms`;

    card.innerHTML = `
      <div class="coin-card__shine"></div>
      <div class="coin-card__glow"></div>
      <div class="coin-card__spotlight"></div>

      <div class="coin-header">
        <div class="coin-main">
          <div class="coin-avatar">
            <img src="${coin.image}" alt="${coin.name}" class="coin-image" />
          </div>

          <div>
            <h2 class="coin-name">${coin.name}</h2>
            <p class="coin-symbol">${coin.symbol.toUpperCase()}</p>
          </div>
        </div>

        <div class="coin-actions">
          <span class="coin-rank">#${coin.market_cap_rank ?? "-"}</span>
          <button class="favorite-btn ${isFavorite ? "active" : ""}" data-id="${coin.id}">
            ${isFavorite ? "★" : "☆"}
          </button>
        </div>
      </div>

      <div class="coin-chart-wrapper">
        ${sparklineSVG}
      </div>

      <div class="coin-price-row">
        <div>
          <p class="mini-label">Поточна ціна</p>
          <p class="coin-price">$${coin.current_price.toLocaleString()}</p>
        </div>

        <div class="change-badge ${changeClass}">
          ${sign}${priceChange.toFixed(2)}%
        </div>
      </div>

      <div class="coin-stats">
        <div class="stat-item">
          <span class="stat-label">Market Cap</span>
          <span class="stat-value">${formatMoney(coin.market_cap)}</span>
        </div>

        <div class="stat-item">
          <span class="stat-label">Volume</span>
          <span class="stat-value">${formatMoney(coin.total_volume)}</span>
        </div>

        <div class="stat-item">
          <span class="stat-label">ATH</span>
          <span class="stat-value">$${coin.ath.toLocaleString()}</span>
        </div>
      </div>

      <button class="details-btn magnetic-btn" data-details-id="${coin.id}">
        Детальніше
      </button>
    `;

    coinsList.appendChild(card);
  });

  bindFavoriteButtons();
  bindDetailsButtons();
  initTiltCards();
  initCardSpotlight();
  initMagneticButtons();
}

function openCoinModal(coinId) {
  const coin = allCoins.find((item) => item.id === coinId);
  if (!coin) return;

  const priceChange = coin.price_change_percentage_24h ?? 0;
  const changeClass = priceChange >= 0 ? "positive" : "negative";
  const sign = priceChange >= 0 ? "+" : "";
  const isPositive = priceChange >= 0;
  const sparklinePrices = coin.sparkline_in_7d?.price || [];
  const bigSparkline = createSparklineSVG(sparklinePrices, isPositive, true);

  modalBody.innerHTML = `
    <div class="modal-coin-header">
      <div class="modal-coin-main">
        <div class="modal-coin-avatar">
          <img src="${coin.image}" alt="${coin.name}" />
        </div>

        <div>
          <h2 class="modal-coin-name">${coin.name}</h2>
          <p class="modal-coin-symbol">${coin.symbol.toUpperCase()} • Rank #${coin.market_cap_rank ?? "-"}</p>
        </div>
      </div>

      <div class="modal-change ${changeClass}">
        ${sign}${priceChange.toFixed(2)}%
      </div>
    </div>

    <div class="modal-chart glass">
      ${bigSparkline}
    </div>

    <div class="modal-grid">
      <div class="modal-stat glass">
        <span>Ціна</span>
        <strong>$${coin.current_price.toLocaleString()}</strong>
      </div>

      <div class="modal-stat glass">
        <span>Market Cap</span>
        <strong>${formatMoney(coin.market_cap)}</strong>
      </div>

      <div class="modal-stat glass">
        <span>Volume</span>
        <strong>${formatMoney(coin.total_volume)}</strong>
      </div>

      <div class="modal-stat glass">
        <span>ATH</span>
        <strong>$${coin.ath.toLocaleString()}</strong>
      </div>

      <div class="modal-stat glass">
        <span>ATL</span>
        <strong>$${coin.atl.toLocaleString()}</strong>
      </div>

      <div class="modal-stat glass">
        <span>Circulating Supply</span>
        <strong>${Math.round(coin.circulating_supply).toLocaleString()}</strong>
      </div>
    </div>
  `;

  coinModal.classList.add("open");
  document.body.classList.add("modal-open");
}

function closeCoinModal() {
  coinModal.classList.remove("open");
  document.body.classList.remove("modal-open");
}

function bindFavoriteButtons() {
  const favoriteButtons = document.querySelectorAll(".favorite-btn");

  favoriteButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFavorite(button.dataset.id);
    });
  });
}

function bindDetailsButtons() {
  const detailButtons = document.querySelectorAll(".details-btn");

  detailButtons.forEach((button) => {
    button.addEventListener("click", () => openCoinModal(button.dataset.detailsId));
  });
}

function initTiltCards() {
  const cards = document.querySelectorAll(".tilt-card");

  cards.forEach((card) => {
    card.addEventListener("mousemove", (event) => {
      const rect = card.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -5;
      const rotateY = ((x - centerX) / centerX) * 5;

      card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });
}

function initCardSpotlight() {
  const cards = document.querySelectorAll(".tilt-card");

  cards.forEach((card) => {
    const spotlight = card.querySelector(".coin-card__spotlight");
    if (!spotlight) return;

    card.addEventListener("mousemove", (event) => {
      const rect = card.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      spotlight.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.12), transparent 35%)`;
    });

    card.addEventListener("mouseleave", () => {
      spotlight.style.background = "transparent";
    });
  });
}

function initMagneticButtons() {
  const buttons = document.querySelectorAll(".magnetic-btn");

  buttons.forEach((button) => {
    button.addEventListener("mousemove", (event) => {
      const rect = button.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;

      button.style.transform = `translate(${x * 0.08}px, ${y * 0.08}px)`;
    });

    button.addEventListener("mouseleave", () => {
      button.style.transform = "";
    });
  });
}

searchInput.addEventListener("input", () => {
  renderCoins(getProcessedCoins());
});

sortSelect.addEventListener("change", () => {
  renderCoins(getProcessedCoins());
});

refreshBtn.addEventListener("click", () => {
  loadCoins();
  showToast("Дані оновлено");
});

favoritesOnlyBtn.addEventListener("click", () => {
  favoritesOnly = !favoritesOnly;
  favoritesOnlyBtn.classList.toggle("active-toggle", favoritesOnly);
  renderCoins(getProcessedCoins());
});

scrollToCoinsBtn.addEventListener("click", () => {
  coinsList.scrollIntoView({ behavior: "smooth", block: "start" });
});

themeToggleBtn.addEventListener("click", () => {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  document.body.dataset.theme = currentTheme;
  localStorage.setItem("themeMode", currentTheme);
  showToast(`Тема: ${currentTheme === "dark" ? "dark" : "light"}`);
});

layoutToggleBtn.addEventListener("click", () => {
  layoutMode = layoutMode === "grid" ? "list" : "grid";
  coinsList.classList.toggle("coins-list--list", layoutMode === "list");
  localStorage.setItem("layoutMode", layoutMode);
  showToast(`Layout: ${layoutMode}`);
});

compareSelectA.addEventListener("change", () => {
  compareCoinA = compareSelectA.value;
  renderCompare();
});

compareSelectB.addEventListener("change", () => {
  compareCoinB = compareSelectB.value;
  renderCompare();
});

clearCompareBtn.addEventListener("click", () => {
  compareCoinA = "";
  compareCoinB = "";
  compareSelectA.value = "";
  compareSelectB.value = "";
  renderCompare();
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    activeFilter = button.dataset.filter;
    renderCoins(getProcessedCoins());
  });
});

modalBackdrop.addEventListener("click", closeCoinModal);
closeModalBtn.addEventListener("click", closeCoinModal);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeCoinModal();
});

document.addEventListener("mousemove", (event) => {
  cursorGlow.style.left = `${event.clientX}px`;
  cursorGlow.style.top = `${event.clientY}px`;
});

heroCard.addEventListener("mousemove", (event) => {
  const rect = heroCard.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const rotateY = ((x - rect.width / 2) / rect.width) * 6;
  const rotateX = ((y - rect.height / 2) / rect.height) * -6;

  heroCard.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
});

heroCard.addEventListener("mouseleave", () => {
  heroCard.style.transform = "";
});

loadCoins();
setInterval(loadCoins, 60000);
