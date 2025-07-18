// script.js

// Import all necessary functions from firestoreService.js
import {
  initializeFirebase,
  addMember,
  updateMember,
  deleteMember,
  recordPayment,
  recordBatchPayments,
  depositBalance,
  setTariff,
  recordExpense,
  resetData,
  setupKasKlub, // Import setupKasKlub as well
} from "./firestoreService.js";

// Global UI State Variables (these will be updated by callbacks from firestoreService.js)
let members = [];
let currentTariff = 0;
let transactions = [];
let expenses = [];
let isAuthReady = false; // Flag to indicate if auth state is ready in firestoreService
const CASH_FUND_MEMBER_ID = "kas_klub"; // Must match the ID in firestoreService.js

// Get last active tab from localStorage, default to "dashboard"
let currentActiveTab = localStorage.getItem("lastActiveTab") || "dashboard";

// --- Utility Functions (UI-specific) ---

// Function to display message box
function showMessageBox(message, type = "info") {
  const msgBox = document.getElementById("message-box");
  msgBox.textContent = message;
  msgBox.classList.remove("bg-teal-500", "bg-green-500", "bg-red-500");
  if (type === "success") {
    msgBox.classList.add("bg-green-500");
  } else if (type === "error") {
    msgBox.classList.add("bg-red-500");
  } else {
    msgBox.classList.add("bg-teal-500");
  }
  msgBox.classList.remove("hidden");
  setTimeout(() => {
    msgBox.classList.add("hidden");
  }, 3000);
}

// Function to show/hide global loading overlay (screensaver)
function toggleActionLoadingOverlay(show) {
  const overlay = document.getElementById("action-loading-overlay");
  if (show) {
    overlay.classList.remove("hidden");
  } else {
    setTimeout(() => {
      overlay.classList.add("hidden");
    }, 500); // Adjust CSS transition duration
  }
}

// Function to show/hide spinner on refresh icon
const refreshIcon = document.getElementById("refresh-icon");
function toggleRefreshSpinner(show) {
  if (show) {
    refreshIcon.classList.add("fa-spin");
  } else {
    refreshIcon.classList.remove("fa-spin");
  }
}

// --- Global Modal Functions ---
const globalModalOverlay = document.getElementById("global-modal-overlay");
const globalModalBody = document.getElementById("global-modal-body");
const globalModalCloseButton = document.getElementById("global-modal-close");

function openModal(contentHtml) {
  globalModalBody.innerHTML = contentHtml;
  globalModalOverlay.classList.remove("hidden");
  globalModalOverlay.classList.add("flex");
}

function closeModal() {
  globalModalOverlay.classList.add("hidden");
  globalModalOverlay.classList.remove("flex");
  globalModalBody.innerHTML = ""; // Clear content on close
}

// Event listener for modal close button
globalModalCloseButton.addEventListener("click", closeModal);
// Event listener for clicking outside modal content
globalModalOverlay.addEventListener("click", (e) => {
  if (e.target === globalModalOverlay) {
    closeModal();
  }
});

// --- Callback Functions for firestoreService.js ---
const onAuthReady = (ready) => {
  isAuthReady = ready;
  if (isAuthReady) {
    activateTab(currentActiveTab); // Activate the initial tab after auth is ready
    toggleActionLoadingOverlay(false); // Hide overlay after initial data load
  }
};

const onMembersUpdate = (updatedMembers) => {
  members = updatedMembers;
  refreshCurrentTab(false, false); // Re-render current tab
};

const onTariffUpdate = (updatedTariff) => {
  currentTariff = updatedTariff;
  refreshCurrentTab(false, false); // Re-render current tab
};

const onTransactionsUpdate = (updatedTransactions) => {
  transactions = updatedTransactions;
  refreshCurrentTab(false, false); // Re-render current tab
};

const onExpensesUpdate = (updatedExpenses) => {
  expenses = updatedExpenses;
  refreshCurrentTab(false, false); // Re-render current tab
};

// --- Main Application Logic (DOMContentLoaded) ---
document.addEventListener("DOMContentLoaded", async () => {
  toggleActionLoadingOverlay(true); // Show initial loading overlay

  // Initialize Firebase services and listeners via firestoreService
  initializeFirebase(
    onAuthReady,
    onMembersUpdate,
    onTariffUpdate,
    onTransactionsUpdate,
    onExpensesUpdate,
    showMessageBox, // Pass showMessageBox as callback
    toggleActionLoadingOverlay, // Pass toggleActionLoadingOverlay as callback
    toggleRefreshSpinner // Pass toggleRefreshSpinner as callback
  );

  // --- Function to refresh data of the current active tab ---
  async function refreshCurrentTab(
    forceFetch = false,
    showSpinnerOverride = true
  ) {
    if (!isAuthReady) {
      console.log("Auth not ready, skipping refreshCurrentTab.");
      return;
    }
    if (showSpinnerOverride) {
      toggleRefreshSpinner(true);
    }
    try {
      switch (currentActiveTab) {
        case "dashboard":
          await renderDashboard();
          break;
        case "iuran":
          await renderIuran();
          break;
        case "pengeluaran":
          await renderPengeluaran();
          break;
        case "anggota":
          await renderAnggota();
          break;
        case "pengaturan":
          await renderPengaturan();
          break;
      }
    } finally {
      if (showSpinnerOverride) {
        toggleRefreshSpinner(false);
      }
    }
  }

  // --- Render Functions for Each Tab ---

  async function renderDashboard() {
    const content = document.getElementById("tab-content-wrapper");
    // Only update innerHTML if the content is not already rendered, or if it's a forced refresh
    // This prevents re-rendering the entire structure on every data update
    if (!content.querySelector("#card-belum-bayar")) {
      // Check if a key element is missing
      content.innerHTML = `
            <!-- Setor Saldo & Setor Kas buttons as cards -->
            <div class="grid grid-cols-2 gap-6 mb-8">
                <!-- Setor Saldo Anggota button as card -->
                <button id="setor-saldo-anggota-btn" class="bg-white rounded-xl shadow-lg p-3 md:p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                    <div class="p-3 rounded-full bg-teal-100 text-teal-600 mb-4">
                        <i class="fas fa-user-plus text-2xl"></i>
                    </div>
                    <span class="text-sm font-medium text-gray-700">Setor Saldo Anggota</span>
                </button>

                <!-- Setor Kas Klub button as card -->
                <button id="setor-kas-klub-btn" class="bg-white rounded-xl shadow-lg p-3 md:p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                    <div class="p-3 rounded-full bg-teal-100 text-teal-600 mb-4">
                        <i class="fas fa-hand-holding-usd text-2xl"></i>
                    </div>
                    <span class="text-sm font-medium text-gray-700">Setor Kas Klub</span>
                </button>
            </div>

            <!-- Summary Cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <!-- Unpaid Amount Card -->
                <div id="card-belum-bayar" class="bg-white rounded-xl shadow-lg p-3 md:p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                    <div class="p-3 rounded-full bg-red-100 text-red-600 mb-4">
                        <i class="fas fa-exclamation-triangle text-2xl"></i>
                    </div>
                    <h3 class="text-sm font-medium text-gray-700 mb-2">Jumlah Urung Bayar Kok</h3>
                    <p class="text-xl md:text-3xl font-bold text-red-700">
                        <span id="unpaid-loading-text" class="text-sm text-teal-500">Memuat...</span>
                        <span id="unpaid-amount-display" class="hidden"></span>
                    </p>
                    <p class="text-xs md:text-sm text-gray-500 mt-2">Ketuk untuk detail iuran belum dibayar</p>
                </div>

                <!-- Total Cash Balance Card -->
                <div class="bg-white rounded-xl shadow-lg p-3 md:p-6 flex flex-col items-center justify-center text-center">
                    <div class="p-3 rounded-full bg-green-100 text-green-600 mb-4">
                        <i class="fas fa-wallet text-2xl"></i>
                    </div>
                    <h3 class="text-sm font-medium text-gray-700 mb-2">Total Saldo Kok</h3>
                    <p class="text-xl md:text-3xl font-bold text-green-700">
                        <span id="balance-loading-text" class="text-sm text-teal-500">Memuat...</span>
                        <span id="total-balance-display" class="hidden"></span>
                    </p>
                    <p class="text-xs md:text-sm text-gray-500 mt-2">Total dana yang tersedia</p>
                </div>
            </div>

            <!-- Member Balance Table -->
            <div class="bg-white rounded-xl shadow-lg p-4 md:p-6">
                <h3 class="text-sm font-medium text-gray-800 mb-4">Tabel Saldo Anggota</h3>
                <div class="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-100">
                            <tr>
                                <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider rounded-tl-lg">Nama</th>
                                <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider rounded-tr-lg">Saldo</th>
                            </tr>
                        </thead>
                        <tbody id="saldo-table-body" class="bg-white divide-y divide-gray-200">
                            <tr><td colspan="2" class="text-center py-2 text-xs md:text-sm text-teal-500">Memuat data...</td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="mt-4 text-xs md:text-sm text-gray-600 text-center">
                    <p>Data saldo diperbarui secara real-time.</p>
                </div>
            </div>
        `;
    }

    // Calculate dashboard summary from local 'members' data
    const unpaidDebts = [];
    let totalUnpaidAmount = 0;
    let totalCashBalance = 0;

    const kasKlubMember = members.find((m) => m.id === CASH_FUND_MEMBER_ID);
    if (kasKlubMember) {
      totalCashBalance = kasKlubMember.balance || 0;
    }

    members.forEach((member) => {
      if (member.id !== CASH_FUND_MEMBER_ID && member.balance < 0) {
        unpaidDebts.push({
          memberId: member.id,
          name: member.name,
          amount: Math.abs(member.balance),
        });
        totalUnpaidAmount += Math.abs(member.balance);
      }
    });

    // Update UI with calculated data
    document.getElementById("unpaid-loading-text").classList.add("hidden");
    document.getElementById("unpaid-amount-display").classList.remove("hidden");
    document.getElementById(
      "unpaid-amount-display"
    ).textContent = `Rp ${totalUnpaidAmount.toLocaleString("id-ID")}`;

    document.getElementById("balance-loading-text").classList.add("hidden");
    document.getElementById("total-balance-display").classList.remove("hidden");
    document.getElementById(
      "total-balance-display"
    ).textContent = `Rp ${totalCashBalance.toLocaleString("id-ID")}`;

    const saldoTableBody = document.getElementById("saldo-table-body");
    const displayMembers = members; // Use the global members array
    saldoTableBody.innerHTML = displayMembers
      .filter((member) => member.id !== CASH_FUND_MEMBER_ID) // Exclude Kas Klub from main member table
      .map(
        (member) => `
              <tr>
                  <td class="px-4 py-2 whitespace-nowrap text-sm md:text-base text-gray-900 rounded-bl-lg">${
                    member.name
                  }</td>
                  <td class="px-4 py-2 whitespace-nowrap text-sm md:text-base ${
                    member.balance < 0
                      ? "text-red-600 font-medium"
                      : "text-gray-900"
                  } rounded-br-lg">
                      Rp ${member.balance.toLocaleString("id-ID")}
                  </td>
              </tr>
          `
      )
      .join("");

    const cardBelumBayar = document.getElementById("card-belum-bayar");
    if (cardBelumBayar) {
      const oldListener = cardBelumBayar._eventListener;
      if (oldListener) {
        cardBelumBayar.removeEventListener("click", oldListener);
      }

      const newListener = () => {
        if (unpaidDebts.length === 0) {
          showMessageBox("Tidak ada iuran yang belum dibayar.", "info");
          return;
        }

        let debtListHtml = `
                    <h3 class="text-base md:text-lg font-semibold mb-4 text-gray-800">Sing urung mbayar kok</h3>
                    <div class="max-h-80 overflow-y-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Utang</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${unpaidDebts
                                  .map(
                                    (debt) => `
                                    <tr data-member-id="${
                                      debt.memberId
                                    }" data-debt-amount="${
                                      debt.amount
                                    }" data-member-name="${debt.name}">
                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">${
                                          debt.name
                                        }</td>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-red-600 font-medium">Rp ${debt.amount.toLocaleString(
                                          "id-ID"
                                        )}</td>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm">
                                            <button class="pay-debt-btn bg-teal-500 text-white px-3 py-1 rounded-md text-xs hover:bg-teal-600 transition-colors">Bayar</button>
                                        </td>
                                    </tr>
                                `
                                  )
                                  .join("")}
                            </tbody>
                        </table>
                    </div>
                `;
        openModal(debtListHtml);

        document.querySelectorAll(".pay-debt-btn").forEach((button) => {
          button.addEventListener("click", (e) => {
            const row = e.target.closest("tr");
            const memberId = row.dataset.memberId;
            const debtAmount = parseFloat(row.dataset.debtAmount);
            const memberName = row.dataset.memberName;

            openModal(`
                            <h3 class="text-base md:text-lg font-semibold mb-4 text-gray-800">Bayar Iuran Belum Dibayar</h3>
                            <form id="form-pay-debt" class="space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Anggota</label>
                                    <input type="text" value="${memberName}" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-gray-100 cursor-not-allowed text-sm md:text-base" readonly>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Jumlah Iuran Belum Dibayar</label>
                                    <input type="text" value="Rp ${debtAmount.toLocaleString(
                                      "id-ID"
                                    )}" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-gray-100 cursor-not-allowed text-sm md:text-base" readonly>
                                </div>
                                <div>
                                    <label for="payment-amount" class="block text-sm font-medium text-gray-700 mb-2">Nominal Pembayaran (Rp)</label>
                                    <input type="number" id="payment-amount" min="1" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 text-sm md:text-base" placeholder="Masukkan jumlah pembayaran">
                                </div>
                                <div class="flex justify-end gap-4">
                                    <button type="button" id="cancel-pay-debt" class="bg-gray-300 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-400 text-sm md:text-base">Batal</button>
                                    <button type="submit" class="bg-teal-600 text-white py-2 px-4 rounded-md hover:bg-teal-700 text-sm md:text-base">Proses Pembayaran</button>
                                </div>
                            </form>
                        `);

            document
              .getElementById("cancel-pay-debt")
              .addEventListener("click", closeModal);
            document
              .getElementById("form-pay-debt")
              .addEventListener("submit", async (payEvent) => {
                payEvent.preventDefault();
                const paymentAmount = parseInt(
                  document.getElementById("payment-amount").value
                );

                if (isNaN(paymentAmount) || paymentAmount <= 0) {
                  showMessageBox("Nominal pembayaran tidak valid.", "error");
                  return;
                }

                closeModal();
                await depositBalance(memberId, paymentAmount); // Call the Firebase function
                // Data will refresh automatically via onSnapshot listeners
              });
          });
        });
      };
      cardBelumBayar.addEventListener("click", newListener);
      cardBelumBayar._eventListener = newListener;
    }

    // Event listener for Setor Saldo Anggota button on Dashboard
    const setorSaldoAnggotaBtn = document.getElementById(
      "setor-saldo-anggota-btn"
    );
    if (setorSaldoAnggotaBtn) {
      const oldSetorSaldoListener = setorSaldoAnggotaBtn._eventListener;
      if (oldSetorSaldoListener) {
        setorSaldoAnggotaBtn.removeEventListener(
          "click",
          oldSetorSaldoListener
        );
      }

      const newSetorSaldoListener = () => {
        openModal(`
                <h3 class="text-base md:text-lg font-semibold mb-4 text-gray-800">Setor Saldo Anggota</h3>
                <form id="form-setor-saldo-dashboard" class="space-y-4 md:space-y-5">
                    <div>
                        <label for="member-select-setor-dashboard" class="block text-sm font-medium text-gray-700 mb-2">Nama Anggota</label>
                        <select id="member-select-setor-dashboard" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 text-sm md:text-base">
                            <option value="">Pilih Anggota</option>
                        </select>
                    </div>
                    <div>
                        <label for="nominal-setor-dashboard" class="block text-sm font-medium text-gray-700 mb-2">Nominal Setor (Rp)</label>
                        <input type="number" id="nominal-setor-dashboard" min="1" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 text-sm md:text-base" placeholder="Contoh: 50000">
                    </div>
                    <div class="flex justify-end gap-4">
                        <button type="button" id="cancel-setor-saldo-dashboard" class="bg-gray-300 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-400 text-sm md:text-base">Batal</button>
                        <button type="submit" class="bg-teal-600 text-white py-2 px-4 rounded-md hover:bg-teal-700 text-sm md:text-base">Setor Saldo</button>
                    </div>
                </form>
            `);

        const memberSelectSetorDashboard = document.getElementById(
          "member-select-setor-dashboard"
        );
        // Populate member dropdown for deposit modal
        members.forEach((member) => {
          // Exclude 'Kas Klub' from deposit options
          if (member.id !== CASH_FUND_MEMBER_ID) {
            const option = document.createElement("option");
            option.value = member.id;
            option.textContent = member.name;
            memberSelectSetorDashboard.appendChild(option);
          }
        });

        document
          .getElementById("cancel-setor-saldo-dashboard")
          .addEventListener("click", closeModal);
        document
          .getElementById("form-setor-saldo-dashboard")
          .addEventListener("submit", async (e) => {
            e.preventDefault();
            const memberId = document.getElementById(
              "member-select-setor-dashboard"
            ).value;
            const nominalSetor = parseInt(
              document.getElementById("nominal-setor-dashboard").value
            );

            if (!memberId || isNaN(nominalSetor) || nominalSetor <= 0) {
              showMessageBox(
                "Harap lengkapi semua bidang dengan benar.",
                "error"
              );
              return;
            }

            closeModal();
            await depositBalance(memberId, nominalSetor); // Call the Firebase function
            // Data will refresh automatically via onSnapshot listeners
          });
      };
      setorSaldoAnggotaBtn.addEventListener("click", newSetorSaldoListener);
      setorSaldoAnggotaBtn._eventListener = newSetorSaldoListener;
    }

    // Event listener for Setor Kas Klub button on Dashboard
    const setorKasKlubBtn = document.getElementById("setor-kas-klub-btn");
    if (setorKasKlubBtn) {
      const oldSetorKasListener = setorKasKlubBtn._eventListener;
      if (oldSetorKasListener) {
        setorKasKlubBtn.removeEventListener("click", oldSetorKasListener);
      }

      const newSetorKasListener = () => {
        openModal(`
                <h3 class="text-base md:text-lg font-semibold mb-4 text-gray-800">Setor Kas Klub</h3>
                <form id="form-setor-kas-klub" class="space-y-4 md:space-y-5">
                    <div>
                        <label for="nominal-setor-kas" class="block text-sm font-medium text-gray-700 mb-2">Nominal Setor (Rp)</label>
                        <input type="number" id="nominal-setor-kas" min="1" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 text-sm md:text-base" placeholder="Contoh: 100000">
                    </div>
                    <div class="flex justify-end gap-4">
                        <button type="button" id="cancel-setor-kas" class="bg-gray-300 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-400 text-sm md:text-base">Batal</button>
                        <button type="submit" class="bg-teal-600 text-white py-2 px-4 rounded-md hover:bg-teal-700 text-sm md:text-base">Setor Kas</button>
                    </div>
                </form>
            `);

        document
          .getElementById("cancel-setor-kas")
          .addEventListener("click", closeModal);
        document
          .getElementById("form-setor-kas-klub")
          .addEventListener("submit", async (e) => {
            e.preventDefault();
            const nominalSetor = parseInt(
              document.getElementById("nominal-setor-kas").value
            );

            if (isNaN(nominalSetor) || nominalSetor <= 0) {
              showMessageBox("Nominal setoran tidak valid.", "error");
              return;
            }

            closeModal();
            await depositBalance(CASH_FUND_MEMBER_ID, nominalSetor); // Call the Firebase function for Kas Klub
            // Data will refresh automatically via onSnapshot listeners
          });
      };
      setorKasKlubBtn.addEventListener("click", newSetorKasListener);
      setorKasKlubBtn._eventListener = newSetorKasListener;
    }
  }

  async function renderIuran() {
    const content = document.getElementById("tab-content-wrapper");
    if (!content.querySelector("#form-input-individu")) {
      // Check if a key element is missing
      content.innerHTML = `
            <div class="bg-white rounded-xl shadow-lg p-4 md:p-6 mb-6">
                <div class="grid grid-cols-3 gap-2 border-b border-gray-200 mb-6">
                    <button id="tab-individu" class="iuran-tab-button flex-1 py-3 text-center text-gray-600 font-medium border-b-2 border-transparent hover:border-gray-300 transition-colors duration-300 text-sm md:text-base">Perorang</button>
                    <button id="tab-kolektif" class="iuran-tab-button flex-1 py-3 text-center text-gray-600 font-medium border-b-2 border-transparent hover:border-gray-300 transition-colors duration-300 text-sm md:text-base">Kolektif</button>
                    <button id="tab-transaksi" class="iuran-tab-button flex-1 py-3 text-center text-gray-600 font-medium border-b-2 border-transparent hover:border-gray-300 transition-colors duration-300 text-sm md:text-base">Transaksi</button>
                </div>

                <!-- Individual Payment Tab Content -->
                <div id="content-individu" class="hidden">
                    <form id="form-input-individu" class="space-y-4 md:space-y-5">
                        <div>
                            <label for="tanggal-iuran" class="block text-sm font-medium text-gray-700 mb-2">Tanggal Iuran</label>
                            <input type="date" id="tanggal-iuran" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 text-sm md:text-base">
                        </div>
                        <div>
                            <label for="member-select-individu" class="block text-sm font-medium text-gray-700 mb-2">Nama Anggota</label>
                            <select id="member-select-individu" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 text-sm md:text-base">
                                <option value="">Pilih Anggota</option>
                            </select>
                        </div>
                        <div>
                            <label for="jumlah-main-individu" class="block text-sm font-medium text-gray-700 mb-2">Jumlah Main</label>
                            <input type="number" id="jumlah-main-individu" min="1" value="1" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 text-sm md:text-base">
                        </div>
                        <div id="status-bayar-wrapper">
                            <label for="status-bayar-individu" class="block text-sm font-medium text-gray-700 mb-2">Status Bayar</label>
                            <select id="status-bayar-individu" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 text-sm md:text-base">
                                <option value="belum_bayar">Belum Bayar</option>
                                <option value="sudah_bayar">Sudah Bayar</option>
                            </select>
                            <p id="saldo-info-individu" class="text-xs md:text-sm text-green-600 font-medium mt-2 hidden"><i class="fas fa-check-circle mr-1"></i>Saldo mencukupi, akan dipotong otomatis.</p>
                        </div>
                        <div>
                            <label for="nominal-iuran" class="block text-sm font-medium text-gray-700 mb-2">Nominal Iuran (Rp)</label>
                            <input type="text" id="nominal-iuran" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-gray-100 cursor-not-allowed text-sm md:text-base" readonly value="Rp 0">
                        </div>
                        <button type="submit" class="w-full bg-teal-600 text-white py-2 md:py-3 px-4 rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200 text-base md:text-lg font-medium">Kirim Iuran</button>
                    </form>
                </div>

                <!-- Collective Payment Tab Content -->
                <div id="content-kolektif" class="hidden">
                    <form id="form-input-kolektif" class="space-y-4 md:space-y-5">
                        <div>
                            <label for="tanggal-iuran-kolektif" class="block text-sm font-medium text-gray-700 mb-2">Tanggal Iuran</label>
                            <input type="date" id="tanggal-iuran-kolektif" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 text-sm md:text-base">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Tarif Per Main Saat Ini</label>
                            <input type="text" id="nominal-tarif-kolektif" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-gray-100 cursor-not-allowed text-sm md:text-base" readonly value="Rp 0">
                        </div>
                        <div class="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-100">
                                    <tr>
                                        <th scope="col" class="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider rounded-tl-lg kolektif-table-name-col">Nama</th>
                                        <th scope="col" class="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider kolektif-table-plays-col">Main</th>
                                        <th scope="col" class="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider rounded-tr-lg kolektif-table-status-col">Status</th>
                                    </tr>
                                </thead>
                                <tbody id="kolektif-table-body" class="bg-white divide-y divide-gray-200">
                                    <!-- Member rows will be populated here -->
                                    <tr><td colspan="3" class="text-center py-2 text-xs md:text-sm text-teal-500">Memuat anggota...</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <button type="submit" class="w-full bg-teal-600 text-white py-2 md:py-3 px-4 rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200 text-base md:text-lg font-medium">Proses Pembayaran Kolektif</button>
                    </form>
                </div>

                <!-- Iuran Transactions Tab Content -->
                <div id="content-transaksi" class="hidden">
                    <h3 class="text-sm font-medium text-gray-800 mb-4">Riwayat Transaksi Iuran</h3>
                    <div id="iuran-transactions-container" class="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-100">
                                <tr>
                                    <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider rounded-tl-lg">Tanggal & Anggota</th>
                                    <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Detail Iuran</th>
                                    <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider rounded-tr-lg">Keterangan</th>
                                </tr>
                            </thead>
                            <tbody id="iuran-transactions-table-body" class="bg-white divide-y divide-gray-200">
                                <tr><td colspan="3" class="text-center py-2 text-xs md:text-sm text-teal-500">Memuat data transaksi...</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="mt-4 text-xs md:text-sm text-gray-600 text-center">
                        <p>Riwayat semua pembayaran iuran.</p>
                    </div>
                </div>
            </div>
        `;

      // Attach event listeners for sub-tab buttons only once
      const tabIndividu = document.getElementById("tab-individu");
      const tabKolektif = document.getElementById("tab-kolektif");
      const tabTransaksi = document.getElementById("tab-transaksi");

      const switchIuranTab = async (activeTabId) => {
        tabIndividu.classList.remove("active", "border-teal-600");
        tabKolektif.classList.remove("active", "border-teal-600");
        tabTransaksi.classList.remove("active", "border-teal-600");
        tabIndividu.classList.add("border-transparent");
        tabKolektif.classList.add("border-transparent");
        tabTransaksi.classList.add("border-transparent");

        document.getElementById("content-individu").classList.add("hidden");
        document.getElementById("content-kolektif").classList.add("hidden");
        document.getElementById("content-transaksi").classList.add("hidden");

        if (activeTabId === "tab-individu") {
          tabIndividu.classList.add("active", "border-teal-600");
          document
            .getElementById("content-individu")
            .classList.remove("hidden");
        } else if (activeTabId === "tab-kolektif") {
          tabKolektif.classList.add("active", "border-teal-600");
          document
            .getElementById("content-kolektif")
            .classList.remove("hidden");
        } else if (activeTabId === "tab-transaksi") {
          tabTransaksi.classList.add("active", "border-teal-600");
          document
            .getElementById("content-transaksi")
            .classList.remove("hidden");
          renderIuranTransactions(); // Render transactions on tab switch
        }
      };

      tabIndividu.addEventListener("click", () =>
        switchIuranTab("tab-individu")
      );
      tabKolektif.addEventListener("click", () =>
        switchIuranTab("tab-kolektif")
      );
      tabTransaksi.addEventListener("click", () =>
        switchIuranTab("tab-transaksi")
      );

      // Default to individual tab when Iuran is first rendered
      switchIuranTab("tab-individu");
    }

    const today = new Date().toISOString().split("T")[0];
    document.getElementById("tanggal-iuran").value = today;
    document.getElementById("tanggal-iuran-kolektif").value = today;

    // Update tariff in collective tab
    document.getElementById(
      "nominal-tarif-kolektif"
    ).value = `Rp ${currentTariff.toLocaleString("id-ID")}`;

    const memberSelectIndividu = document.getElementById(
      "member-select-individu"
    );
    const kolektifTableBody = document.getElementById("kolektif-table-body");

    memberSelectIndividu.innerHTML = '<option value="">Pilih Anggota</option>';
    kolektifTableBody.innerHTML = ""; // Clear first

    members.forEach((member) => {
      // For individual tab
      const option1 = document.createElement("option");
      option1.value = member.id;
      option1.textContent = member.name;
      memberSelectIndividu.appendChild(option1);

      // For collective tab (excluding Kas Klub)
      if (member.id !== CASH_FUND_MEMBER_ID) {
        const row = document.createElement("tr");
        row.dataset.memberId = member.id;
        row.dataset.memberName = member.name; // Store name for reference
        row.innerHTML = `
                <td class="px-2 py-2 text-sm text-gray-900 kolektif-table-name-col">${member.name}</td>
                <td class="px-2 py-2 text-sm kolektif-table-plays-col">
                    <input type="number" value="1" min="0" class="jumlah-main-kolektif mt-1 block w-full px-1 py-0.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 text-sm">
                </td>
                <td class="px-2 py-2 text-sm kolektif-table-status-col">
                    <select class="status-bayar-kolektif mt-1 block w-full px-1 py-0.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 text-sm">
                        <option value="belum_bayar">Belum Bayar</option>
                        <option value="sudah_bayar">Sudah Bayar</option>
                    </select>
                </td>
            `;
        kolektifTableBody.appendChild(row);
      }
    });

    const formIndividu = document.getElementById("form-input-individu");
    const memberSelectIndividuEl = document.getElementById(
      "member-select-individu"
    );
    const jumlahMainIndividuEl = document.getElementById(
      "jumlah-main-individu"
    );
    const tanggalIuranEl = document.getElementById("tanggal-iuran");
    const nominalIuranEl = document.getElementById("nominal-iuran");
    const statusBayarWrapper = document.getElementById("status-bayar-wrapper");
    const statusBayarIndividuEl = document.getElementById(
      "status-bayar-individu"
    );
    const saldoInfoIndividuEl = document.getElementById("saldo-info-individu");

    const updateNominalAndSaldo = () => {
      const jumlahMain = parseInt(jumlahMainIndividuEl.value);
      const nominal = jumlahMain * currentTariff;
      nominalIuranEl.value = `Rp ${nominal.toLocaleString("id-ID")}`;

      const selectedMemberId = memberSelectIndividuEl.value;
      const member = members.find((m) => m.id === selectedMemberId);

      if (member && member.balance >= nominal && nominal > 0) {
        statusBayarWrapper.classList.add("hidden");
        statusBayarIndividuEl.value = "sudah_bayar";
        saldoInfoIndividuEl.classList.remove("hidden");
      } else {
        statusBayarWrapper.classList.remove("hidden");
        statusBayarIndividuEl.value = "belum_bayar";
        saldoInfoIndividuEl.classList.add("hidden");
      }
    };

    // Remove old listeners to prevent duplicates
    const oldMemberSelectIndividuListener =
      memberSelectIndividuEl._eventListener;
    if (oldMemberSelectIndividuListener) {
      memberSelectIndividuEl.removeEventListener(
        "change",
        oldMemberSelectIndividuListener
      );
    }
    const oldJumlahMainIndividuListener = jumlahMainIndividuEl._eventListener;
    if (oldJumlahMainIndividuListener) {
      jumlahMainIndividuEl.removeEventListener(
        "input",
        oldJumlahMainIndividuListener
      );
    }
    const oldFormIndividuListener = formIndividu._eventListener;
    if (oldFormIndividuListener) {
      formIndividu.removeEventListener("submit", oldFormIndividuListener);
    }

    memberSelectIndividuEl.addEventListener("change", updateNominalAndSaldo);
    memberSelectIndividuEl._eventListener = updateNominalAndSaldo; // Store listener reference

    jumlahMainIndividuEl.addEventListener("input", updateNominalAndSaldo);
    jumlahMainIndividuEl._eventListener = updateNominalAndSaldo; // Store listener reference

    updateNominalAndSaldo(); // Initial calculation

    formIndividu.addEventListener("submit", async (e) => {
      e.preventDefault();
      const memberId = memberSelectIndividuEl.value;
      const jumlahMain = parseInt(jumlahMainIndividuEl.value);
      const statusBayar = statusBayarIndividuEl.value;
      const tanggal = tanggalIuranEl.value;
      const nominal = jumlahMain * currentTariff; // Nominal is recalculated

      if (!memberId || isNaN(jumlahMain) || jumlahMain <= 0 || !tanggal) {
        showMessageBox("Harap lengkapi semua bidang dengan benar.", "error");
        return;
      }

      let paymentMethod = "none";
      const payingMember = members.find((m) => m.id === memberId);

      if (statusBayar === "sudah_bayar") {
        if (payingMember && payingMember.balance >= nominal) {
          paymentMethod = "balance";
        } else {
          paymentMethod = "cash";
        }
      }

      await recordPayment(
        memberId,
        jumlahMain,
        statusBayar,
        currentTariff,
        tanggal,
        paymentMethod
      );

      formIndividu.reset();
      tanggalIuranEl.value = today;
      updateNominalAndSaldo();
      // Data will refresh automatically via onSnapshot listeners
    });
    formIndividu._eventListener = formIndividu.eventListener; // Store listener reference

    // Logic for Collective Payment Tab
    const formKolektif = document.getElementById("form-input-kolektif");
    // Remove old listener to prevent duplicates
    const oldFormKolektifListener = formKolektif._eventListener;
    if (oldFormKolektifListener) {
      formKolektif.removeEventListener("submit", oldFormKolektifListener);
    }

    formKolektif.addEventListener("submit", async (e) => {
      e.preventDefault();
      const tanggalKolektif = document.getElementById(
        "tanggal-iuran-kolektif"
      ).value;
      const tarifKolektif = currentTariff; // Use global fetched tariff

      if (!tanggalKolektif) {
        showMessageBox("Harap pilih tanggal iuran.", "error");
        return;
      }
      if (tarifKolektif <= 0) {
        showMessageBox(
          "Tarif per main belum diatur atau nol. Harap atur di Pengaturan.",
          "error"
        );
        return;
      }

      const payments = [];
      const rows = kolektifTableBody.querySelectorAll("tr");
      for (const row of rows) {
        const memberId = row.dataset.memberId;
        const memberName = row.dataset.memberName;
        const jumlahMainInput = row.querySelector(".jumlah-main-kolektif");
        const statusBayarSelect = row.querySelector(".status-bayar-kolektif");

        const jumlahMain = parseInt(jumlahMainInput.value);
        const statusBayar = statusBayarSelect.value;

        if (isNaN(jumlahMain) || jumlahMain < 0) {
          showMessageBox(
            `Jumlah main untuk ${memberName} tidak valid.`,
            "error"
          );
          return;
        }

        if (jumlahMain > 0) {
          payments.push({
            memberId: memberId,
            memberName: memberName,
            jumlahMain: jumlahMain,
            statusBayar: statusBayar,
            tariff: tarifKolektif,
            date: tanggalKolektif,
          });
        }
      }

      if (payments.length === 0) {
        showMessageBox(
          "Tidak ada pembayaran yang diisi untuk diproses.",
          "info"
        );
        return;
      }

      await recordBatchPayments(payments);

      // Clear form after success
      formKolektif.reset();
      document.getElementById("tanggal-iuran-kolektif").value = today;
      // Reset jumlah main in table to 1
      kolektifTableBody
        .querySelectorAll(".jumlah-main-kolektif")
        .forEach((input) => (input.value = "1"));
      // Reset status bayar in table to "belum_bayar"
      kolektifTableBody
        .querySelectorAll(".status-bayar-kolektif")
        .forEach((select) => (select.value = "belum_bayar"));
      // Data will refresh automatically via onSnapshot listeners
    });
    formKolektif._eventListener = formKolektif.eventListener; // Store listener reference
  }

  // Function to render iuran transactions (reads from global 'transactions' array)
  function renderIuranTransactions() {
    const iuranTransactionsTableBody = document.getElementById(
      "iuran-transactions-table-body"
    );
    if (!iuranTransactionsTableBody) return; // Ensure element exists

    if (transactions && transactions.length > 0) {
      iuranTransactionsTableBody.innerHTML = transactions
        .map((transaction) => {
          // Format date to DD-MM-YYYY
          const dateObj = transaction.date
            ? new Date(transaction.date)
            : new Date();
          const formattedDate = `${String(dateObj.getDate()).padStart(
            2,
            "0"
          )}-${String(dateObj.getMonth() + 1).padStart(
            2,
            "0"
          )}-${dateObj.getFullYear()}`;

          let keteranganText = "";
          let keteranganClass = ""; // For text color

          // Determine description text and class based on transaction type
          if (transaction.type === "Pelunasan Utang") {
            keteranganText = "Pelunasan Utang";
            keteranganClass = "text-green-600";
          } else if (transaction.type === "Bayar Utang") {
            keteranganText = "Bayar Utang";
            keteranganClass = "text-orange-600";
          } else if (transaction.type === "Pelunasan dan Tambah Saldo") {
            keteranganText = "Pelunasan dan Tambah Saldo";
            keteranganClass = "text-blue-600";
          } else if (transaction.type === "Setoran Saldo") {
            keteranganText = "Setoran Saldo";
            keteranganClass = "text-purple-600";
          } else if (transaction.type === "Iuran") {
            keteranganText =
              transaction.statusIuran === "Lunas"
                ? "Iuran Lunas"
                : "Iuran Belum Lunas";
            keteranganClass =
              transaction.statusIuran === "Lunas"
                ? "text-teal-600"
                : "text-red-600";
          } else {
            keteranganText = transaction.type || "N/A";
            keteranganClass = "text-gray-600";
          }

          return `
                <tr>
                    <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                        <div class="font-medium">${formattedDate}</div>
                        <div class="text-xs text-gray-600">${
                          transaction.memberName
                        }</div>
                    </td>
                    <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                        <div class="font-medium">Jumlah ${
                          transaction.jumlahMain
                        }</div>
                        <div class="text-xs text-gray-600">Rp ${transaction.nominal.toLocaleString(
                          "id-ID"
                        )}</div>
                    </td>
                    <td class="px-4 py-2 whitespace-nowrap text-sm ${keteranganClass}">${keteranganText}</td>
                </tr>
            `;
        })
        .join("");
    } else {
      iuranTransactionsTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-2 text-xs md:text-sm text-gray-500">Tidak ada riwayat transaksi iuran.</td></tr>`;
    }
  }

  // Pengeluaran Tab
  async function renderPengeluaran() {
    const content = document.getElementById("tab-content-wrapper");
    if (!content.querySelector("#form-pengeluaran")) {
      // Check if a key element is missing
      content.innerHTML = `
            <div class="bg-white rounded-xl shadow-lg p-4 md:p-6 mb-6">
                <h3 class="text-sm font-medium text-gray-700 mb-4">Kirim Pengeluaran</h3>
                <form id="form-pengeluaran" class="space-y-4 md:space-y-5">
                    <div>
                        <label for="keterangan-pengeluaran" class="block text-sm font-medium text-gray-700 mb-2">Keterangan</label>
                        <input type="text" id="keterangan-pengeluaran" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 text-sm md:text-base" placeholder="Contoh: Beli kok, Sewa lapangan">
                    </div>
                    <div>
                        <label for="nominal-pengeluaran" class="block text-sm font-medium text-gray-700 mb-2">Nominal (Rp)</label>
                        <input type="number" id="nominal-pengeluaran" min="1" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 text-sm md:text-base" placeholder="Contoh: 150000">
                    </div>
                    <div>
                        <label for="tanggal-pengeluaran" class="block text-sm font-medium text-gray-700 mb-2">Tanggal</label>
                        <input type="date" id="tanggal-pengeluaran" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 text-sm md:text-base">
                    </div>
                    <button type="submit" class="w-full bg-teal-600 text-white py-2 md:py-3 px-4 rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200 text-base md:text-lg font-medium">Kirim Pengeluaran</button>
                    </form>
            </div>

            <div class="bg-white rounded-xl shadow-lg p-4 md:p-6">
                <h3 class="text-sm font-medium text-gray-800 mb-4">Daftar Pengeluaran</h3>
                <div class="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-100">
                            <tr>
                                <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider rounded-tl-lg">Tanggal</th>
                                <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Keterangan</th>
                                <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider rounded-tr-lg">Nominal</th>
                            </tr>
                        </thead>
                        <tbody id="pengeluaran-table-body" class="bg-white divide-y divide-gray-200">
                            <tr><td colspan="3" class="text-center py-2 text-xs md:text-sm text-teal-500">Memuat data...</td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="mt-4 text-xs md:text-sm text-gray-600 text-center">
                    <p>Catatan semua pengeluaran terkait badminton.</p>
                </div>
            </div>
        `;
    }

    const today = new Date().toISOString().split("T")[0];
    document.getElementById("tanggal-pengeluaran").value = today;

    const pengeluaranTableBody = document.getElementById(
      "pengeluaran-table-body"
    );
    if (expenses && expenses.length > 0) {
      pengeluaranTableBody.innerHTML = expenses
        .map(
          (expense) => `
                <tr>
                    <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">${
                      expense.date
                    }</td>
                    <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">${
                      expense.description
                    }</td>
                    <td class="px-4 py-2 whitespace-nowrap text-sm text-red-600 font-medium">Rp ${expense.amount.toLocaleString(
                      "id-ID"
                    )}</td>
                </tr>
            `
        )
        .join("");
    } else {
      pengeluaranTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-2 text-xs md:text-sm text-teal-500">Tidak ada data pengeluaran.</td></tr>`;
    }

    const formPengeluaran = document.getElementById("form-pengeluaran");
    // Remove old listener to prevent duplicates
    const oldFormPengeluaranListener = formPengeluaran._eventListener;
    if (oldFormPengeluaranListener) {
      formPengeluaran.removeEventListener("submit", oldFormPengeluaranListener);
    }

    formPengeluaran.addEventListener("submit", async (e) => {
      e.preventDefault();
      const description = document.getElementById(
        "keterangan-pengeluaran"
      ).value;
      const amount = parseInt(
        document.getElementById("nominal-pengeluaran").value
      );
      const date = document.getElementById("tanggal-pengeluaran").value;

      if (!description || isNaN(amount) || amount <= 0 || !date) {
        showMessageBox("Harap lengkapi semua bidang dengan benar.", "error");
        return;
      }

      await recordExpense(description, amount, date);

      document.getElementById("form-pengeluaran").reset();
      document.getElementById("tanggal-pengeluaran").value = today;
      // Data will refresh automatically via onSnapshot listeners
    });
    formPengeluaran._eventListener = formPengeluaran.eventListener; // Store listener reference
  }

  async function renderPengaturan() {
    const content = document.getElementById("tab-content-wrapper");
    if (!content) {
      console.error("tab-content-wrapper not found for Pengaturan!");
      return;
    }
    if (!content.querySelector("#form-atur-tarif")) {
      // Check if a key element is missing
      content.innerHTML = `
            <div class="bg-white rounded-xl shadow-lg p-4 md:p-6 mb-6">
                <h3 class="text-sm font-medium text-gray-700 mb-4">Atur Tarif Main</h3>
                <form id="form-atur-tarif" class="space-y-4 md:space-y-5">
                    <div>
                        <label for="nominal-tarif" class="block text-sm font-medium text-gray-700 mb-2">Nominal Tarif Main (Rp)</label>
                        <input type="number" id="nominal-tarif" min="0" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 text-sm md:text-base" placeholder="Contoh: 15000">
                    </div>
                    <button type="submit" class="w-full bg-teal-600 text-white py-2 md:py-3 px-4 rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200 text-base md:text-lg font-medium">Simpan Tarif</button>
                </form>
                <p class="text-xs md:text-sm text-gray-500 mt-4 text-center">Tarif yang disimpan akan berlaku mulai hari ini.</p>
                <p id="current-tariff-display" class="text-sm md:text-base font-medium text-gray-800 mt-4 text-center">Tarif saat ini: Rp 0</p>
            </div>

            <div class="bg-white rounded-xl shadow-lg p-4 md:p-6 mb-6">
                <h3 class="text-sm font-medium text-gray-700 mb-4">Reset Data</h3>
                <button id="reset-data-btn" class="w-full bg-red-600 text-white py-2 md:py-3 px-4 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200 text-base md:text-lg font-medium">Reset Data Aplikasi</button>
                <p class="text-xs md:text-sm text-gray-500 mt-2 text-center">Hapus semua atau sebagian data transaksi Anda.</p>
            </div>

            <div class="bg-white rounded-xl shadow-lg p-4 md:p-6">
                <h3 class="text-sm font-medium text-gray-700 mb-4">Informasi Aplikasi</h3>
                <div class="text-gray-700 space-y-2">
                    <p class="text-xs md:text-sm"><i class="fas fa-info-circle mr-2 text-teal-500"></i>Versi: 1.0.0</p>
                    <p class="text-xs md:text-sm"><i class="fas fa-code-branch mr-2 text-green-500"></i>Pengembang: Lokasport Pegundungan</p>
                    <p class="text-xs md:text-sm"><i class="fas fa-calendar-alt mr-2 text-purple-500"></i>Tanggal Rilis: Juli 2025</p>
                    <p class="text-xs md:text-sm text-gray-500 mt-4">Aplikasi ini dirancang untuk membantu pengelolaan iuran bulutangkis dengan mudah.</p>
                </div>
            </div>
        `;
    }

    const nominalTarifEl = document.getElementById("nominal-tarif");
    const currentTariffDisplayEl = document.getElementById(
      "current-tariff-display"
    );

    if (nominalTarifEl) nominalTarifEl.value = currentTariff;
    if (currentTariffDisplayEl) {
      currentTariffDisplayEl.textContent = `Tarif saat ini: Rp ${currentTariff.toLocaleString(
        "id-ID"
      )}`;
    }

    const formAturTarif = document.getElementById("form-atur-tarif");
    if (formAturTarif) {
      // Remove old listener
      const oldFormAturTarifListener = formAturTarif._eventListener;
      if (oldFormAturTarifListener) {
        formAturTarif.removeEventListener("submit", oldFormAturTarifListener);
      }

      const newFormAturTarifListener = async (e) => {
        e.preventDefault();
        const nominalTarif = parseInt(
          document.getElementById("nominal-tarif").value
        );

        if (isNaN(nominalTarif) || nominalTarif < 0) {
          showMessageBox("Nominal tarif tidak valid.", "error");
          return;
        }

        await setTariff(nominalTarif);
        // Data will refresh automatically via onSnapshot listeners
      };
      formAturTarif.addEventListener("submit", newFormAturTarifListener);
      formAturTarif._eventListener = newFormAturTarifListener; // Store listener reference
    }

    const resetDataBtn = document.getElementById("reset-data-btn");
    if (resetDataBtn) {
      // Remove old listener
      const oldResetDataBtnListener = resetDataBtn._eventListener;
      if (oldResetDataBtnListener) {
        resetDataBtn.removeEventListener("click", oldResetDataBtnListener);
      }

      const newResetDataBtnListener = () => {
        openModal(`
                <h3 class="text-base md:text-lg font-semibold mb-4 text-gray-800">Pilih Opsi Reset Data</h3>
                <p class="text-xs md:text-base text-red-600 font-medium"><i class="fas fa-exclamation-triangle mr-2"></i>Perhatian: Aksi ini tidak dapat dibatalkan!</p>
                <form id="form-reset-data" class="space-y-4">
                    <div>
                        <label class="inline-flex items-center">
                            <input type="radio" name="reset-type" value="all" class="form-radio text-teal-600 h-4 w-4" checked>
                            <span class="ml-2 text-gray-700 text-sm md:text-base">Reset Semua Data (Anggota, Iuran, Pengeluaran, Tarif)</span>
                        </label>
                        <p class="text-xs text-gray-500 ml-6">Menghapus semua data dari aplikasi dan mengembalikan ke kondisi awal.</p>
                    </div>
                    <div>
                        <label class="inline-flex items-center">
                            <input type="radio" name="reset-type" value="monthAgo" class="form-radio text-teal-600 h-4 w-4">
                            <span class="ml-2 text-gray-700 text-sm md:text-base">Reset Data Transaksi Satu Bulan Lalu</span>
                        </label>
                        <p class="text-xs text-gray-500 ml-6">Menghapus semua iuran dan pengeluaran yang lebih lama dari awal bulan lalu. Saldo anggota akan direset ke 0.</p>
                    </div>
                    <div>
                        <label class="inline-flex items-center">
                            <input type="radio" name="reset-type" value="dateRange" class="form-radio text-teal-600 h-4 w-4">
                            <span class="ml-2 text-gray-700 text-sm md:text-base">Reset Data Transaksi Berdasarkan Rentang Tanggal</span>
                        </label>
                        <p class="text-xs text-gray-500 ml-6">Menghapus iuran dan pengeluaran dalam rentang tanggal yang ditentukan. Saldo anggota akan direset ke 0.</p>
                    </div>

                    <div id="date-range-inputs" class="space-y-3 p-4 border border-gray-200 rounded-lg hidden">
                        <div>
                            <label for="reset-start-date" class="block text-sm font-medium text-gray-700 mb-2">Tanggal Mulai</label>
                            <input type="date" id="reset-start-date" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 text-sm md:text-base">
                        </div>
                        <div>
                            <label for="reset-end-date" class="block text-sm font-medium text-gray-700 mb-2">Tanggal Akhir</label>
                            <input type="date" id="reset-end-date" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 text-sm md:text-base">
                        </div>
                    </div>

                    <div class="flex justify-end gap-4 mt-6">
                        <button type="button" id="cancel-reset-data" class="bg-gray-300 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-400 text-sm md:text-base">Batal</button>
                        <button type="submit" class="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 text-sm md:text-base">Konfirmasi Reset</button>
                    </div>
                </form>
            `);

        const formResetData = document.getElementById("form-reset-data");
        const dateRangeInputs = document.getElementById("date-range-inputs");
        const radioButtons = formResetData.querySelectorAll(
          'input[name="reset-type"]'
        );
        const resetStartDateEl = document.getElementById("reset-start-date");
        const resetEndDateEl = document.getElementById("reset-end-date");

        if (resetEndDateEl)
          resetEndDateEl.value = new Date().toISOString().split("T")[0];

        radioButtons.forEach((radio) => {
          radio.addEventListener("change", (e) => {
            if (e.target.value === "dateRange") {
              if (dateRangeInputs) dateRangeInputs.classList.remove("hidden");
            } else {
              if (dateRangeInputs) dateRangeInputs.classList.add("hidden");
            }
          });
        });

        document
          .getElementById("cancel-reset-data")
          .addEventListener("click", closeModal);

        // Remove old listener for formResetData to prevent duplicates
        const oldFormResetDataListener = formResetData._eventListener;
        if (oldFormResetDataListener) {
          formResetData.removeEventListener("submit", oldFormResetDataListener);
        }

        const newFormResetDataListener = async (e) => {
          e.preventDefault();
          const selectedResetType = formResetData.querySelector(
            'input[name="reset-type"]:checked'
          ).value;
          let startDate = null;
          let endDate = null;

          if (selectedResetType === "dateRange") {
            startDate = resetStartDateEl ? resetStartDateEl.value : "";
            endDate = resetEndDateEl ? resetEndDateEl.value : "";
            if (!startDate || !endDate) {
              showMessageBox(
                "Harap lengkapi tanggal mulai dan akhir untuk reset rentang tanggal.",
                "error"
              );
              return;
            }
          }

          openModal(`
              <h3 class="text-base md:text-lg font-semibold mb-4 text-gray-800">Konfirmasi Reset Data</h3>
              <p class="mb-6 text-xs md:text-base text-red-600 font-medium">
                  <i class="fas fa-exclamation-triangle mr-2"></i>
                  Anda yakin ingin melakukan reset data ini? Aksi ini tidak dapat dibatalkan!
              </p>
              <div class="flex justify-end gap-4">
                  <button id="final-cancel-reset" class="bg-gray-300 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-400 text-sm md:text-base">Batal</button>
                  <button id="final-confirm-reset" class="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 text-sm md:text-base">Ya, Reset Data</button>
              </div>
          `);

          document
            .getElementById("final-cancel-reset")
            .addEventListener("click", closeModal);
          document
            .getElementById("final-confirm-reset")
            .addEventListener("click", async () => {
              closeModal();
              await resetData(selectedResetType, startDate, endDate);
              activateTab("dashboard"); // Go back to dashboard after reset
            });
        };
        formResetData.addEventListener("submit", newFormResetDataListener);
        formResetData._eventListener = newFormResetDataListener; // Store listener reference
      };
      resetDataBtn.addEventListener("click", newResetDataBtnListener);
      resetDataBtn._eventListener = newResetDataBtnListener; // Store listener reference
    }
  }

  async function renderAnggota() {
    const content = document.getElementById("tab-content-wrapper");
    if (!content.querySelector("#form-tambah-anggota")) {
      // Check if a key element is missing
      content.innerHTML = `
            <div class="bg-white rounded-xl shadow-lg p-4 md:p-6 mb-6">
                <h3 class="text-sm font-medium text-gray-700 mb-4">Tambah Anggota Baru</h3>
                <form id="form-tambah-anggota" class="flex flex-col sm:flex-row gap-4">
                    <input type="text" id="nama-anggota-baru" class="flex-grow px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 text-sm md:text-base" placeholder="Nama Anggota Baru (pisahkan dengan koma untuk banyak nama)">
                    <button type="submit" class="bg-teal-600 text-white py-2 px-4 rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200 text-base font-medium">Tambah Anggota</button>
                </form>
            </div>

            <div class="bg-white rounded-xl shadow-lg p-4 md:p-6">
                <h3 class="text-sm font-medium text-gray-800 mb-4">Daftar Anggota</h3>
                <div class="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-100">
                            <tr>
                                <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider rounded-tl-lg">Nama</th>
                                <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase tracking-wider rounded-tr-lg">Aksi</th>
                            </tr>
                        </thead>
                        <tbody id="anggota-table-body" class="bg-white divide-y divide-gray-200">
                            <tr><td colspan="2" class="text-center py-2 text-xs md:text-sm text-teal-500">Memuat data...</td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="mt-4 text-xs md:text-sm text-gray-600 text-center">
                    <p>Kelola daftar anggota klub bulutangkis Anda.</p>
                </div>
            </div>
        `;
    }

    const anggotaTableBody = document.getElementById("anggota-table-body");
    renderMembersTable(anggotaTableBody);

    const formTambahAnggota = document.getElementById("form-tambah-anggota");
    // Remove old listener to prevent duplicates
    const oldFormTambahAnggotaListener = formTambahAnggota._eventListener;
    if (oldFormTambahAnggotaListener) {
      formTambahAnggota.removeEventListener(
        "submit",
        oldFormTambahAnggotaListener
      );
    }

    formTambahAnggota.addEventListener("submit", async (e) => {
      e.preventDefault();
      const newMemberNamesInput = document
        .getElementById("nama-anggota-baru")
        .value.trim();

      if (!newMemberNamesInput) {
        showMessageBox("Nama anggota tidak boleh kosong.", "error");
        return;
      }

      const namesToAdd = newMemberNamesInput
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name !== "");

      if (namesToAdd.length === 0) {
        showMessageBox(
          "Nama anggota tidak valid. Harap masukkan setidaknya satu nama.",
          "error"
        );
        return;
      }

      const addPromises = [];
      for (const name of namesToAdd) {
        // Check for duplicate names before adding to avoid unnecessary Firestore calls
        if (!members.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
          addPromises.push(addMember(name));
        } else {
          showMessageBox(
            `Nama '${name}' sudah ada, tidak ditambahkan.`,
            "info"
          );
        }
      }

      const results = await Promise.allSettled(addPromises);

      let successCount = 0;
      let errorMessages = [];
      results.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value.success) {
          successCount++;
        } else {
          // Find the name that corresponds to this failed promise
          const failedName = namesToAdd[index];
          const errorMessage = result.value
            ? result.value.message
            : result.reason
            ? result.reason.message
            : "Unknown error";
          errorMessages.push(
            `Gagal menambahkan '${failedName}': ${errorMessage}`
          );
        }
      });

      if (errorMessages.length === 0) {
        showMessageBox(
          `Berhasil menambahkan ${successCount} anggota baru.`,
          "success"
        );
      } else if (successCount > 0) {
        showMessageBox(
          `Berhasil menambahkan ${successCount} anggota. ${
            errorMessages.length
          } gagal: ${errorMessages.join("; ")}`,
          "error"
        );
      } else {
        showMessageBox(
          `Gagal menambahkan anggota: ${errorMessages.join("; ")}`,
          "error"
        );
      }
      document.getElementById("nama-anggota-baru").value = ""; // Clear input
      // Data will refresh automatically via onSnapshot listeners
    });
    formTambahAnggota._eventListener = formTambahAnggota.eventListener; // Store listener reference

    function renderMembersTable(tableBodyEl) {
      // Filter out the 'Kas Klub' member from the display table
      const membersToDisplay = members.filter(
        (member) => member.id !== CASH_FUND_MEMBER_ID
      );

      tableBodyEl.innerHTML = membersToDisplay
        .map(
          (member) => `
                <tr data-member-id="${member.id}">
                    <td class="px-4 py-2 whitespace-nowrap text-sm md:text-base text-gray-900">
                        <span class="member-name-display">${member.name}</span>
                        <input type="text" class="member-name-input hidden w-full px-2 py-1 border border-gray-300 rounded-md text-sm" value="${member.name}">
                    </td>
                    <td class="px-4 py-2 whitespace-nowrap text-right text-sm md:text-base">
                        <button class="edit-member-btn text-teal-600 hover:text-teal-900 mr-2 p-1 rounded-md hover:bg-teal-100 transition-colors duration-200"><i class="fas fa-edit"></i></button>
                        <button class="save-member-btn text-green-600 hover:text-green-900 mr-2 hidden p-1 rounded-md hover:bg-green-100 transition-colors duration-200"><i class="fas fa-save"></i></button>
                        <button class="cancel-edit-btn text-gray-600 hover:text-gray-900 mr-2 hidden p-1 rounded-md hover:bg-gray-100 transition-colors duration-200"><i class="fas fa-times"></i></button>
                        <button class="delete-member-btn text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-100 transition-colors duration-200"><i class="fas fa-trash-alt"></i></button>
                    </td>
                </tr>
            `
        )
        .join("");

      tableBodyEl.querySelectorAll(".edit-member-btn").forEach((button) => {
        // Remove old listener to prevent duplicates
        const oldEditListener = button._eventListener;
        if (oldEditListener)
          button.removeEventListener("click", oldEditListener);

        const newEditListener = (e) => {
          const row = e.target.closest("tr");
          const displaySpan = row.querySelector(".member-name-display");
          const inputField = row.querySelector(".member-name-input");
          const editBtn = row.querySelector(".edit-member-btn");
          const saveBtn = row.querySelector(".save-member-btn");
          const cancelBtn = row.querySelector(".cancel-edit-btn");

          displaySpan.classList.add("hidden");
          inputField.classList.remove("hidden");
          editBtn.classList.add("hidden");
          saveBtn.classList.remove("hidden");
          cancelBtn.classList.remove("hidden");
          inputField.focus();
        };
        button.addEventListener("click", newEditListener);
        button._eventListener = newEditListener;
      });

      tableBodyEl.querySelectorAll(".cancel-edit-btn").forEach((button) => {
        // Remove old listener to prevent duplicates
        const oldCancelListener = button._eventListener;
        if (oldCancelListener)
          button.removeEventListener("click", oldCancelListener);

        const newCancelListener = (e) => {
          const row = e.target.closest("tr");
          const displaySpan = row.querySelector(".member-name-display");
          const inputField = row.querySelector(".member-name-input");
          const editBtn = row.querySelector(".edit-member-btn");
          const saveBtn = row.querySelector(".save-member-btn");
          const cancelBtn = row.querySelector(".cancel-edit-btn");

          inputField.value = displaySpan.textContent;
          displaySpan.classList.remove("hidden");
          inputField.classList.add("hidden");
          editBtn.classList.remove("hidden");
          saveBtn.classList.add("hidden");
          cancelBtn.classList.add("hidden");
        };
        button.addEventListener("click", newCancelListener);
        button._eventListener = newCancelListener;
      });

      tableBodyEl.querySelectorAll(".save-member-btn").forEach((button) => {
        // Remove old listener to prevent duplicates
        const oldSaveListener = button._eventListener;
        if (oldSaveListener)
          button.removeEventListener("click", oldSaveListener);

        const newSaveListener = async (e) => {
          const row = e.target.closest("tr");
          const memberId = row.dataset.memberId;
          const inputField = row.querySelector(".member-name-input");
          const newName = inputField.value.trim();

          if (!newName) {
            showMessageBox("Nama anggota tidak boleh kosong.", "error");
            return;
          }

          const result = await updateMember(memberId, newName);
          // Data will refresh automatically via onSnapshot listeners
        };
        button.addEventListener("click", newSaveListener);
        button._eventListener = newSaveListener;
      });

      tableBodyEl.querySelectorAll(".delete-member-btn").forEach((button) => {
        // Remove old listener to prevent duplicates
        const oldDeleteListener = button._eventListener;
        if (oldDeleteListener)
          button.removeEventListener("click", oldDeleteListener);

        const newDeleteListener = (e) => {
          const row = e.target.closest("tr");
          const memberId = row.dataset.memberId;
          const memberName = row.querySelector(
            ".member-name-display"
          ).textContent;

          openModal(`
                        <h3 class="text-base md:text-lg font-semibold mb-4 text-gray-800">Konfirmasi Hapus</h3>
                        <p class="mb-6 text-xs md:text-base">Apakah Anda yakin ingin menghapus anggota <strong>${memberName}</strong>?</p>
                        <div class="flex justify-end gap-4">
                            <button id="confirm-delete-cancel" class="bg-gray-300 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-400 text-sm md:text-base">Batal</button>
                            <button id="final-confirm-delete" class="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 text-sm md:text-base">Hapus</button>
                        </div>
                    `);

          document
            .getElementById("confirm-delete-cancel")
            .addEventListener("click", closeModal);
          document
            .getElementById("final-confirm-delete")
            .addEventListener("click", async () => {
              closeModal();
              await deleteMember(memberId);
              // Data will refresh automatically via onSnapshot listeners
            });
        };
        button.addEventListener("click", newDeleteListener);
        button._eventListener = newDeleteListener;
      });
    }
  }

  // --- Navigation Logic ---
  const tabButtons = document.querySelectorAll(".tab-button");
  const appContent = document.getElementById("app-content");

  // Array defining tab order
  const tabOrder = [
    "dashboard",
    "iuran",
    "pengeluaran",
    "anggota",
    "pengaturan",
  ];

  // Create content wrapper div inside main
  const tabContentWrapper = document.createElement("div");
  tabContentWrapper.id = "tab-content-wrapper";
  tabContentWrapper.classList.add("w-full", "h-full"); // Ensure it fills main area
  appContent.appendChild(tabContentWrapper);

  // Main function to activate tab
  function activateTab(newTabId) {
    const oldTabId = currentActiveTab;
    // If new tab is same as old, or this is initial load and tab is already active,
    // then no need to do anything.
    if (
      oldTabId === newTabId &&
      tabContentWrapper.classList.contains("is-active") &&
      isAuthReady // Only skip if auth is ready and content is already active
    ) {
      return;
    }

    const oldTabIndex = tabOrder.indexOf(oldTabId);
    const newTabIndex = tabOrder.indexOf(newTabId);

    let direction = "none"; // Default: no slide animation (e.g., initial load)
    if (
      oldTabIndex !== -1 &&
      newTabIndex !== -1 &&
      oldTabIndex !== newTabIndex
    ) {
      direction = newTabIndex > oldTabIndex ? "forward" : "backward";
    }

    // Save current active tab to localStorage
    localStorage.setItem("lastActiveTab", newTabId);

    // Update active class on navigation buttons
    tabButtons.forEach((button) => {
      const icon = button.querySelector("i");
      // Remove all specific icon color classes
      icon.classList.remove(
        "text-teal-600",
        "text-green-600",
        "text-purple-600",
        "text-red-600",
        "text-yellow-600"
      );

      if (button.id === `nav-${newTabId}`) {
        button.classList.add("active");
        // Add specific color class for active tab
        if (newTabId === "dashboard") icon.classList.add("text-teal-600");
        else if (newTabId === "iuran") icon.classList.add("text-green-600");
        else if (newTabId === "pengeluaran") icon.classList.add("text-red-600");
        else if (newTabId === "anggota") icon.classList.add("text-yellow-600");
        else if (newTabId === "pengaturan")
          icon.classList.add("text-purple-600");
      } else {
        button.classList.remove("active");
        // Set inactive tab icon to default gray color
        icon.classList.add("text-gray-500");
      }
    });

    // Function to render tab content
    const renderContent = () => {
      // Clear content only if it's a different tab or initial load
      if (oldTabId !== newTabId || !tabContentWrapper.innerHTML) {
        tabContentWrapper.innerHTML = "";
      }

      switch (newTabId) {
        case "dashboard":
          renderDashboard();
          break;
        case "iuran":
          renderIuran();
          break;
        case "pengeluaran":
          renderPengeluaran();
          break;
        case "anggota":
          renderAnggota();
          break;
        case "pengaturan":
          renderPengaturan();
          break;
        default:
          renderDashboard();
          break;
      }
      currentActiveTab = newTabId; // Update currentActiveTab after rendering
    };

    if (direction !== "none") {
      // Remove all previous animation classes from tabContentWrapper
      tabContentWrapper.classList.remove(
        "is-active",
        "is-entering-left",
        "is-entering-right",
        "is-leaving-left",
        "is-leaving-right"
      );

      // Apply exit animation to tabContentWrapper
      if (direction === "forward") {
        tabContentWrapper.classList.add("is-leaving-left");
      } else {
        tabContentWrapper.classList.add("is-leaving-right");
      }

      // After exit animation completes, render new content and start enter animation
      setTimeout(() => {
        tabContentWrapper.classList.remove(
          "is-leaving-left",
          "is-leaving-right"
        ); // Remove exit classes

        // Apply 'is-entering' class for initial position of entering animation on tabContentWrapper
        if (direction === "forward") {
          tabContentWrapper.classList.add("is-entering-right");
        } else {
          tabContentWrapper.classList.add("is-entering-left");
        }

        renderContent(); // Render new content into tabContentWrapper

        // Force reflow for 'is-entering' to 'is-active' transition to work
        void tabContentWrapper.offsetWidth;

        // Apply 'is-active' class to start enter animation on tabContentWrapper
        tabContentWrapper.classList.remove(
          "is-entering-left",
          "is-entering-right"
        );
        tabContentWrapper.classList.add("is-active");
      }, 200); // CSS transition duration for exit
    } else {
      // For initial load or click on same tab, render directly without slide animation
      tabContentWrapper.classList.remove(
        "is-leaving-left",
        "is-leaving-right",
        "is-entering-left",
        "is-entering-right"
      );
      renderContent();
      tabContentWrapper.classList.add("is-active"); // Ensure always active
    }
  }

  // --- Event Listeners ---
  document
    .getElementById("refresh-button")
    .addEventListener("click", () => refreshCurrentTab(true)); // Force refresh

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabId = button.id.replace("nav-", "");
      activateTab(tabId);
    });
  });

  // --- Swipe Logic for Tab Navigation ---
  let startX = 0;
  let endX = 0;
  const swipeThreshold = 50; // Minimum distance (pixels) to be considered a swipe

  appContent.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
  });

  appContent.addEventListener("touchend", (e) => {
    endX = e.changedTouches[0].clientX;
    const diff = startX - endX;

    const currentIndex = tabOrder.indexOf(currentActiveTab);
    let nextTabIndex = -1;

    if (diff > swipeThreshold) {
      // Swipe left (move to next tab)
      nextTabIndex = currentIndex + 1;
    } else if (diff < -swipeThreshold) {
      // Swipe right (move to previous tab)
      nextTabIndex = currentIndex - 1;
    }

    if (nextTabIndex !== -1) {
      if (nextTabIndex >= 0 && nextTabIndex < tabOrder.length) {
        activateTab(tabOrder[nextTabIndex]);
      } else {
        showMessageBox("Anda sudah di tab pertama atau terakhir.", "info");
      }
    }
  });
});
