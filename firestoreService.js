// firestoreService.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  getDocs,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase Configuration - Ini adalah tempat yang benar untuk firebaseConfig
const firebaseConfig = {
  apiKey: "AIzaSyC9sw48J_JpcIhrV_3mGfCeqar76JJ8ZFI",
  authDomain: "aplikasiiuranbadminton.firebaseapp.com",
  projectId: "aplikasiiuranbadminton",
  storageBucket: "aplikasiiuranbadminton.firebasestorage.app",
  messagingSenderId: "231670223728",
  appId: "1:231670223728:web:a025c249cc13fe00d875b5",
  measurementId: "G-4F0HKS0V0Y",
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Global Firebase-related variables
let userId = null;
const appId = firebaseConfig.appId; // App ID from config
const CASH_FUND_MEMBER_ID = "kas_klub"; // Specific ID for club cash balance

// Collection References (initialized after userId is available)
let membersColRef;
let transactionsColRef;
let expensesColRef;
let settingsDocRef; // For tariff settings

// Callbacks to notify the UI layer (script.js) about data changes
const _onDataUpdateCallbacks = {
  onAuthReady: null,
  onMembersUpdate: null,
  onTariffUpdate: null,
  onTransactionsUpdate: null,
  onExpensesUpdate: null,
  onMessageBox: null, // Callback for showing messages
  onToggleLoadingOverlay: null, // Callback for loading overlay
  onToggleRefreshSpinner: null, // Callback for refresh spinner
};

/**
 * Initializes Firebase authentication and sets up real-time data listeners.
 * This function is called once from the UI layer (script.js) and receives callbacks
 * to update the UI when data changes.
 * @param {function} onAuthReadyCallback Callback when authentication is ready.
 * @param {function} onMembersUpdateCallback Callback when members data changes.
 * @param {function} onTariffUpdateCallback Callback when tariff data changes.
 * @param {function} onTransactionsUpdateCallback Callback when transactions data changes.
 * @param {function} onExpensesUpdateCallback Callback when expenses data changes.
 * @param {function} onMessageBoxCallback Callback for displaying messages.
 * @param {function} onToggleLoadingOverlayCallback Callback for showing/hiding loading overlay.
 * @param {function} onToggleRefreshSpinnerCallback Callback for showing/hiding refresh spinner.
 */
export const initializeFirebase = (
  onAuthReadyCallback,
  onMembersUpdateCallback,
  onTariffUpdateCallback,
  onTransactionsUpdateCallback,
  onExpensesUpdateCallback,
  onMessageBoxCallback,
  onToggleLoadingOverlayCallback,
  onToggleRefreshSpinnerCallback
) => {
  _onDataUpdateCallbacks.onAuthReady = onAuthReadyCallback;
  _onDataUpdateCallbacks.onMembersUpdate = onMembersUpdateCallback;
  _onDataUpdateCallbacks.onTariffUpdate = onTariffUpdateCallback;
  _onDataUpdateCallbacks.onTransactionsUpdate = onTransactionsUpdateCallback;
  _onDataUpdateCallbacks.onExpensesUpdate = onExpensesUpdateCallback;
  _onDataUpdateCallbacks.onMessageBox = onMessageBoxCallback;
  _onDataUpdateCallbacks.onToggleLoadingOverlay =
    onToggleLoadingOverlayCallback;
  _onDataUpdateCallbacks.onToggleRefreshSpinner =
    onToggleRefreshSpinnerCallback;

  // Firebase Auth Listener
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      userId = user.uid;
      console.log("Authenticated with userId:", userId);
    } else {
      try {
        await signInAnonymously(auth);
        userId = auth.currentUser.uid;
        console.log("Signed in anonymously with userId:", userId);
      } catch (error) {
        console.error("Error signing in:", error);
        _onDataUpdateCallbacks.onMessageBox(
          "Gagal melakukan autentikasi.",
          "error"
        );
      }
    }

    // Initialize collection references AFTER userId is set
    membersColRef = collection(
      db,
      `artifacts/${appId}/users/${userId}/members`
    );
    transactionsColRef = collection(
      db,
      `artifacts/${appId}/users/${userId}/transactions`
    );
    expensesColRef = collection(
      db,
      `artifacts/${appId}/users/${userId}/expenses`
    );
    settingsDocRef = doc(
      db,
      `artifacts/${appId}/users/${userId}/settings/tariff`
    );

    await setupKasKlub(); // Ensure Kas Klub exists before setting up listeners
    setupFirestoreListeners(); // Start listening to data changes
    _onDataUpdateCallbacks.onAuthReady(true); // Notify UI that auth is ready
  });
};

// Firestore Realtime Listeners (onSnapshot)
let unsubscribeMembers = null;
let unsubscribeSettings = null;
let unsubscribeExpenses = null;
let unsubscribeTransactions = null;

const setupFirestoreListeners = () => {
  if (
    !userId ||
    !membersColRef ||
    !transactionsColRef ||
    !expensesColRef ||
    !settingsDocRef
  ) {
    console.log(
      "Firestore references not fully initialized, skipping Firestore listeners setup."
    );
    return;
  }

  // Unsubscribe existing listeners to prevent duplicates
  if (unsubscribeMembers) unsubscribeMembers();
  if (unsubscribeSettings) unsubscribeSettings();
  if (unsubscribeExpenses) unsubscribeExpenses();
  if (unsubscribeTransactions) unsubscribeTransactions();

  // Members Listener
  unsubscribeMembers = onSnapshot(
    membersColRef,
    (snapshot) => {
      const membersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log(
        "Members updated from Firestore via onSnapshot:",
        membersData
      );
      _onDataUpdateCallbacks.onMembersUpdate(membersData);
    },
    (error) => {
      console.error("Error fetching members:", error);
      _onDataUpdateCallbacks.onMessageBox(
        "Gagal memuat data anggota.",
        "error"
      );
    }
  );

  // Settings (Tariff) Listener
  unsubscribeSettings = onSnapshot(
    settingsDocRef,
    (docSnap) => {
      let tariffValue = 0;
      if (docSnap.exists()) {
        tariffValue = docSnap.data().value || 0;
        console.log("Tariff updated from Firestore:", tariffValue);
      } else {
        console.log("Tariff document does not exist, setting to 0.");
      }
      _onDataUpdateCallbacks.onTariffUpdate(tariffValue);
    },
    (error) => {
      console.error("Error fetching tariff:", error);
      _onDataUpdateCallbacks.onMessageBox("Gagal memuat data tarif.", "error");
    }
  );

  // Expenses Listener
  unsubscribeExpenses = onSnapshot(
    expensesColRef,
    (snapshot) => {
      const expensesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      // Sort expenses by timestamp (latest first)
      expensesData.sort((a, b) => {
        const timestampA = a.timestamp ? a.timestamp.toDate() : new Date(0);
        const timestampB = b.timestamp ? b.timestamp.toDate() : new Date(0);
        return timestampB - timestampA;
      });
      _onDataUpdateCallbacks.onExpensesUpdate(expensesData);
    },
    (error) => {
      console.error("Error fetching expenses:", error);
      _onDataUpdateCallbacks.onMessageBox(
        "Gagal memuat data pengeluaran.",
        "error"
      );
    }
  );

  // Transactions Listener
  unsubscribeTransactions = onSnapshot(
    transactionsColRef,
    (snapshot) => {
      const transactionsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      // Sort transactions by timestamp (latest first)
      transactionsData.sort((a, b) => {
        const timestampA = a.timestamp ? a.timestamp.toDate() : new Date(0);
        const timestampB = b.timestamp ? b.timestamp.toDate() : new Date(0);
        return timestampB - timestampA;
      });
      _onDataUpdateCallbacks.onTransactionsUpdate(transactionsData);
    },
    (error) => {
      console.error("Error fetching transactions:", error);
      _onDataUpdateCallbacks.onMessageBox(
        "Gagal memuat data transaksi.",
        "error"
      );
    }
  );
};

/**
 * Ensures the 'Kas Klub' member exists in the database.
 * If it doesn't exist, it will be created with a balance of 0.
 */
export async function setupKasKlub() {
  if (!userId) {
    console.warn("User ID not available for Kas Klub setup.");
    return;
  }
  const kasKlubDocRef = doc(membersColRef, CASH_FUND_MEMBER_ID);
  try {
    const docSnap = await getDoc(kasKlubDocRef);
    if (!docSnap.exists()) {
      await setDoc(kasKlubDocRef, {
        name: "Kas Klub",
        balance: 0,
        createdAt: serverTimestamp(),
      });
      console.log("Kas Klub member created.");
    }
  } catch (error) {
    console.error("Error setting up Kas Klub member:", error);
  }
}

/**
 * Adds a new member to the Firestore database.
 * @param {string} name The name of the new member.
 * @returns {Promise<object>} An object indicating success or failure.
 */
export async function addMember(name) {
  _onDataUpdateCallbacks.onToggleRefreshSpinner(true);
  try {
    const newMemberRef = await addDoc(membersColRef, {
      name: name,
      balance: 0,
      createdAt: serverTimestamp(),
    });
    _onDataUpdateCallbacks.onMessageBox("Anggota ditambahkan.", "success");
    return { success: true, id: newMemberRef.id };
  } catch (error) {
    console.error("Error adding member:", error);
    _onDataUpdateCallbacks.onMessageBox(
      `Gagal menambahkan anggota: ${error.message}`,
      "error"
    );
    return { success: false, message: error.message };
  } finally {
    _onDataUpdateCallbacks.onToggleRefreshSpinner(false);
  }
}

/**
 * Updates an existing member's name in the Firestore database.
 * @param {string} id The ID of the member to update.
 * @param {string} newName The new name for the member.
 * @returns {Promise<object>} An object indicating success or failure.
 */
export async function updateMember(id, newName) {
  _onDataUpdateCallbacks.onToggleRefreshSpinner(true);
  try {
    const memberDocRef = doc(membersColRef, id);
    await updateDoc(memberDocRef, { name: newName });
    _onDataUpdateCallbacks.onMessageBox("Anggota diperbarui.", "success");
    return { success: true };
  } catch (error) {
    console.error("Error updating member:", error);
    _onDataUpdateCallbacks.onMessageBox(
      `Gagal memperbarui anggota: ${error.message}`,
      "error"
    );
    return { success: false, message: error.message };
  } finally {
    _onDataUpdateCallbacks.onToggleRefreshSpinner(false);
  }
}

/**
 * Deletes a member and all their associated transactions from Firestore.
 * This operation is performed within a transaction to ensure atomicity.
 * @param {string} id The ID of the member to delete.
 * @returns {Promise<object>} An object indicating success or failure.
 */
export async function deleteMember(id) {
  _onDataUpdateCallbacks.onToggleRefreshSpinner(true);
  try {
    await runTransaction(db, async (transaction) => {
      const memberDocRef = doc(membersColRef, id);
      const memberDoc = await transaction.get(memberDocRef);

      if (!memberDoc.exists()) {
        throw new Error("Anggota tidak ditemukan.");
      }

      const memberName = memberDoc.data().name;

      // Delete member document
      transaction.delete(memberDocRef);

      // Delete related transactions
      const q = query(transactionsColRef, where("memberId", "==", id)); // Use memberId for transactions
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        transaction.delete(doc.ref);
      });
    });
    _onDataUpdateCallbacks.onMessageBox(
      "Anggota dan semua transaksinya berhasil dihapus.",
      "success"
    );
    return { success: true };
  } catch (error) {
    console.error("Error deleting member:", error);
    _onDataUpdateCallbacks.onMessageBox(
      `Gagal menghapus anggota: ${error.message}`,
      "error"
    );
    return { success: false, message: error.message };
  } finally {
    _onDataUpdateCallbacks.onToggleRefreshSpinner(false);
  }
}

/**
 * Records an individual payment (iuran) for a member.
 * Handles balance updates for the member and Kas Klub, and creates a transaction record.
 * @param {string} memberId The ID of the member.
 * @param {number} jumlahMain The number of games played.
 * @param {string} statusBayar Payment status ("belum_bayar" or "sudah_bayar").
 * @param {number} tariff Current tariff per game.
 * @param {string} date Date of the payment (YYYY-MM-DD).
 * @param {string} paymentMethod Payment method ("balance" or "cash").
 * @returns {Promise<object>} An object indicating success or failure.
 */
export async function recordPayment(
  memberId,
  jumlahMain,
  statusBayar,
  tariff,
  date,
  paymentMethod
) {
  _onDataUpdateCallbacks.onToggleRefreshSpinner(true);
  try {
    await runTransaction(db, async (transaction) => {
      const memberDocRef = doc(membersColRef, memberId);
      const kasKlubDocRef = doc(membersColRef, CASH_FUND_MEMBER_ID);

      const memberDoc = await transaction.get(memberDocRef);
      const kasKlubDoc = await transaction.get(kasKlubDocRef);

      if (!memberDoc.exists()) {
        throw new Error(`Anggota dengan ID ${memberId} tidak ditemukan.`);
      }
      if (!kasKlubDoc.exists()) {
        throw new Error(
          `Anggota Kas Klub dengan ID ${CASH_FUND_MEMBER_ID} tidak ditemukan.`
        );
      }

      const memberData = memberDoc.data();
      const kasKlubData = kasKlubDoc.data();

      const nominalIuran = jumlahMain * tariff;
      let newMemberBalance = memberData.balance || 0;
      let newKasKlubBalance = kasKlubData.balance || 0;
      let transactionType = "Iuran"; // Default type

      if (statusBayar === "belum_bayar") {
        newMemberBalance -= nominalIuran; // Member's balance decreases (debt increases)
      } else if (statusBayar === "sudah_bayar") {
        if (paymentMethod === "balance") {
          newMemberBalance -= nominalIuran; // Member's balance decreases from their balance
        } else if (paymentMethod === "cash") {
          newKasKlubBalance += nominalIuran; // Kas Klub balance increases from cash payment
        }
      }

      // Update member balance
      transaction.update(memberDocRef, { balance: newMemberBalance });

      // Update Kas Klub balance
      transaction.update(kasKlubDocRef, { balance: newKasKlubBalance });

      // Add transaction record
      const newTransactionRef = doc(transactionsColRef);
      transaction.set(newTransactionRef, {
        date: date,
        memberName: memberData.name,
        memberId: memberId,
        jumlahMain: jumlahMain,
        nominal: nominalIuran,
        type: transactionType,
        statusIuran: statusBayar === "sudah_bayar" ? "Lunas" : "Belum Lunas",
        metodePembayaran: paymentMethod,
        timestamp: serverTimestamp(),
      });
    });
    _onDataUpdateCallbacks.onMessageBox("Iuran berhasil dicatat.", "success");
    return { success: true };
  } catch (error) {
    console.error("Error recording payment:", error);
    _onDataUpdateCallbacks.onMessageBox(
      `Gagal mencatat iuran: ${error.message}`,
      "error"
    );
    return { success: false, message: error.message };
  } finally {
    _onDataUpdateCallbacks.onToggleRefreshSpinner(false);
  }
}

/**
 * Records multiple payments (iuran) in a batch for various members.
 * This operation is performed within a single transaction.
 * @param {Array<object>} payments An array of payment objects, each containing memberId, jumlahMain, statusBayar, tariff, date.
 * @returns {Promise<object>} An object indicating success or failure.
 */
export async function recordBatchPayments(payments) {
  _onDataUpdateCallbacks.onToggleRefreshSpinner(true);
  try {
    await runTransaction(db, async (transaction) => {
      const kasKlubDocRef = doc(membersColRef, CASH_FUND_MEMBER_ID);
      const kasKlubDoc = await transaction.get(kasKlubDocRef);
      if (!kasKlubDoc.exists()) {
        throw new Error(
          `Anggota Kas Klub dengan ID ${CASH_FUND_MEMBER_ID} tidak ditemukan.`
        );
      }
      let currentKasKlubBalance = kasKlubDoc.data().balance || 0;

      for (const payment of payments) {
        const memberDocRef = doc(membersColRef, payment.memberId);
        const memberDoc = await transaction.get(memberDocRef);

        if (!memberDoc.exists()) {
          console.warn(
            `Member with ID ${payment.memberId} not found for batch payment, skipping.`
          );
          continue;
        }

        const memberData = memberDoc.data();
        const nominalIuran = payment.jumlahMain * payment.tariff;
        let newMemberBalance = memberData.balance || 0;
        let paymentMethod =
          payment.statusBayar === "sudah_bayar" ? "cash" : "none";

        if (payment.statusBayar === "belum_bayar") {
          newMemberBalance -= nominalIuran;
        } else if (payment.statusBayar === "sudah_bayar") {
          currentKasKlubBalance += nominalIuran; // Assume cash payment for collective
        }

        transaction.update(memberDocRef, { balance: newMemberBalance });

        const newTransactionRef = doc(transactionsColRef);
        transaction.set(newTransactionRef, {
          date: payment.date,
          memberName: memberData.name,
          memberId: payment.memberId,
          jumlahMain: payment.jumlahMain,
          nominal: nominalIuran,
          type: "Iuran",
          statusIuran:
            payment.statusBayar === "sudah_bayar" ? "Lunas" : "Belum Lunas",
          metodePembayaran: paymentMethod,
          timestamp: serverTimestamp(),
        });
      }
      transaction.update(kasKlubDocRef, { balance: currentKasKlubBalance });
    });
    _onDataUpdateCallbacks.onMessageBox(
      `${payments.length} pembayaran berhasil dicatat.`,
      "success"
    );
    return { success: true };
  } catch (error) {
    console.error("Error recording batch payments:", error);
    _onDataUpdateCallbacks.onMessageBox(
      `Gagal mencatat pembayaran kolektif: ${error.message}`,
      "error"
    );
    return { success: false, message: error.message };
  } finally {
    _onDataUpdateCallbacks.onToggleRefreshSpinner(false);
  }
}

/**
 * Deposits a specified amount into a member's balance or the Kas Klub balance.
 * This operation is performed within a transaction.
 * @param {string} memberId The ID of the member (or CASH_FUND_MEMBER_ID for Kas Klub).
 * @param {number} amount The amount to deposit.
 * @returns {Promise<object>} An object indicating success or failure.
 */
export async function depositBalance(memberId, amount) {
  _onDataUpdateCallbacks.onToggleRefreshSpinner(true);
  try {
    await runTransaction(db, async (transaction) => {
      const memberDocRef = doc(membersColRef, memberId);
      const kasKlubDocRef = doc(membersColRef, CASH_FUND_MEMBER_ID);

      const memberDoc = await transaction.get(memberDocRef);
      const kasKlubDoc = await transaction.get(kasKlubDocRef);

      if (!memberDoc.exists()) {
        throw new Error("Anggota tidak ditemukan.");
      }
      if (!kasKlubDoc.exists()) {
        throw new Error(
          `Anggota Kas Klub dengan ID ${CASH_FUND_MEMBER_ID} tidak ditemukan.`
        );
      }

      const memberData = memberDoc.data();
      const kasKlubData = kasKlubDoc.data();

      const currentMemberBalance = memberData.balance || 0;
      const originalDepositAmount = amount;
      let newMemberBalance = currentMemberBalance;
      let newKasKlubBalance = kasKlubData.balance || 0;

      // Logic to mark 'Belum Lunas' Iuran as 'Lunas' after deposit (only for regular members)
      let unpaidIuranDocs = [];
      if (memberId !== CASH_FUND_MEMBER_ID) {
        const unpaidIuranQuery = query(
          transactionsColRef,
          where("memberId", "==", memberId),
          where("type", "==", "Iuran"),
          where("statusIuran", "==", "Belum Lunas")
        );
        const unpaidIuranSnapshot = await transaction.get(unpaidIuranQuery);
        unpaidIuranDocs = unpaidIuranSnapshot.docs.sort((a, b) => {
          const tsA = a.data().timestamp
            ? a.data().timestamp.toDate()
            : new Date(0);
          const tsB = b.data().timestamp
            ? b.data().timestamp.toDate()
            : new Date(0);
          return tsA - tsB; // Sort by oldest first
        });
      }

      // Update member balance and Kas Klub balance based on deposit type
      if (memberId !== CASH_FUND_MEMBER_ID) {
        // Deposit to a regular member
        newMemberBalance += originalDepositAmount;
        newKasKlubBalance += originalDepositAmount; // Kas Klub also increases
      } else {
        // Deposit directly to Kas Klub
        newMemberBalance += originalDepositAmount; // This is the Kas Klub member's balance
        newKasKlubBalance = newMemberBalance; // Sync Kas Klub balance
      }

      // Update member balance
      transaction.update(memberDocRef, { balance: newMemberBalance });
      // Update Kas Klub balance
      transaction.update(kasKlubDocRef, { balance: newKasKlubBalance });

      // Determine transaction type for deposit
      let transactionType = "Setoran Saldo"; // Default
      if (memberId !== CASH_FUND_MEMBER_ID && currentMemberBalance < 0) {
        const outstandingDebt = Math.abs(currentMemberBalance);
        if (originalDepositAmount >= outstandingDebt) {
          transactionType = "Pelunasan Utang";
          if (originalDepositAmount > outstandingDebt) {
            transactionType = "Pelunasan dan Tambah Saldo";
          }
        } else {
          transactionType = "Bayar Utang";
        }
      }

      // Add deposit transaction record
      const newTransactionRef = doc(transactionsColRef);
      transaction.set(newTransactionRef, {
        date: new Date().toISOString().split("T")[0],
        memberName: memberData.name,
        memberId: memberId,
        jumlahMain: 0,
        nominal: originalDepositAmount,
        type: transactionType,
        statusIuran: "Lunas", // Deposits are always considered paid
        metodePembayaran: "cash", // Assume cash/transfer for deposits
        timestamp: serverTimestamp(),
      });

      // Apply remaining deposit to unpaid Iuran transactions for regular members
      let remainingDepositToApply = originalDepositAmount;
      if (memberId !== CASH_FUND_MEMBER_ID) {
        for (const doc of unpaidIuranDocs) {
          if (remainingDepositToApply <= 0) break;

          const nominalIuranEntry = doc.data().nominal || 0;
          if (doc.data().statusIuran === "Belum Lunas") {
            // Double check status
            if (remainingDepositToApply >= nominalIuranEntry) {
              transaction.update(doc.ref, { statusIuran: "Lunas" });
              remainingDepositToApply -= nominalIuranEntry;
            } else {
              // Partial payment, but we don't track partial status for individual Iuran entries
              // For simplicity, we just stop applying if deposit is less than next unpaid iuran
              remainingDepositToApply = 0;
            }
          }
        }
      }
    });
    _onDataUpdateCallbacks.onMessageBox(
      "Saldo ditambah dan utang diperbarui.",
      "success"
    );
    return { success: true };
  } catch (error) {
    console.error("Error depositing balance:", error);
    _onDataUpdateCallbacks.onMessageBox(
      `Gagal menyetor saldo: ${error.message}`,
      "error"
    );
    return { success: false, message: error.message };
  } finally {
    _onDataUpdateCallbacks.onToggleRefreshSpinner(false);
  }
}

/**
 * Sets the current tariff value in Firestore.
 * @param {number} tariffValue The new tariff value.
 * @returns {Promise<object>} An object indicating success or failure.
 */
export async function setTariff(tariffValue) {
  _onDataUpdateCallbacks.onToggleRefreshSpinner(true);
  try {
    await setDoc(settingsDocRef, {
      value: tariffValue,
      date: new Date().toISOString().split("T")[0],
      timestamp: serverTimestamp(),
    });
    _onDataUpdateCallbacks.onMessageBox("Tarif berhasil disimpan!", "success");
    return { success: true };
  } catch (error) {
    console.error("Error setting tariff:", error);
    _onDataUpdateCallbacks.onMessageBox(
      `Gagal menyimpan tarif: ${error.message}`,
      "error"
    );
    return { success: false, message: error.message };
  } finally {
    _onDataUpdateCallbacks.onToggleRefreshSpinner(false);
  }
}

/**
 * Records a new expense in Firestore.
 * Updates the Kas Klub balance accordingly.
 * @param {string} description Description of the expense.
 * @param {number} amount The amount of the expense.
 * @param {string} date Date of the expense (YYYY-MM-DD).
 * @returns {Promise<object>} An object indicating success or failure.
 */
export async function recordExpense(description, amount, date) {
  _onDataUpdateCallbacks.onToggleRefreshSpinner(true);
  try {
    await runTransaction(db, async (transaction) => {
      const kasKlubDocRef = doc(membersColRef, CASH_FUND_MEMBER_ID);
      const kasKlubDoc = await transaction.get(kasKlubDocRef);
      if (!kasKlubDoc.exists()) {
        throw new Error(
          `Anggota Kas Klub dengan ID ${CASH_FUND_MEMBER_ID} tidak ditemukan.`
        );
      }

      const currentKasKlubBalance = kasKlubDoc.data().balance || 0;
      const newKasKlubBalance = currentKasKlubBalance - amount;

      // Add expense record
      const newExpenseRef = doc(expensesColRef);
      transaction.set(newExpenseRef, {
        description: description,
        amount: amount,
        date: date,
        timestamp: serverTimestamp(),
      });

      // Update Kas Klub balance
      transaction.update(kasKlubDocRef, { balance: newKasKlubBalance });
    });
    _onDataUpdateCallbacks.onMessageBox(
      "Pengeluaran dicatat dan saldo kas diperbarui.",
      "success"
    );
    return { success: true };
  } catch (error) {
    console.error("Error recording expense:", error);
    _onDataUpdateCallbacks.onMessageBox(
      `Gagal mencatat pengeluaran: ${error.message}`,
      "error"
    );
    return { success: false, message: error.message };
  } finally {
    _onDataUpdateCallbacks.onToggleRefreshSpinner(false);
  }
}

/**
 * Resets application data based on the specified type.
 * This operation is performed within a transaction to ensure atomicity.
 * @param {string} resetType Type of reset ("all", "monthAgo", or "dateRange").
 * @param {string} [startDate=null] Start date for "dateRange" reset (YYYY-MM-DD).
 * @param {string} [endDate=null] End date for "dateRange" reset (YYYY-MM-DD).
 * @returns {Promise<object>} An object indicating success or failure.
 */
export async function resetData(resetType, startDate = null, endDate = null) {
  _onDataUpdateCallbacks.onToggleRefreshSpinner(true);
  try {
    await runTransaction(db, async (transaction) => {
      if (resetType === "all") {
        // Delete all members (except Kas Klub), transactions, expenses, and settings
        const allMembersSnapshot = await getDocs(membersColRef);
        allMembersSnapshot.forEach((docSnap) => {
          if (docSnap.id !== CASH_FUND_MEMBER_ID) {
            // Don't delete Kas Klub
            transaction.delete(docSnap.ref);
          } else {
            // Reset Kas Klub balance
            transaction.update(docSnap.ref, { balance: 0 });
          }
        });

        const allTransactionsSnapshot = await getDocs(transactionsColRef);
        allTransactionsSnapshot.forEach((docSnap) => {
          transaction.delete(docSnap.ref);
        });

        const allExpensesSnapshot = await getDocs(expensesColRef);
        allExpensesSnapshot.forEach((docSnap) => {
          transaction.delete(docSnap.ref);
        });

        // Reset tariff to 0
        transaction.set(settingsDocRef, {
          value: 0,
          date: new Date().toISOString().split("T")[0],
          timestamp: serverTimestamp(),
        });

        // Ensure Kas Klub member exists and has 0 balance if it was deleted or didn't exist
        const kasKlubDoc = await transaction.get(
          doc(membersColRef, CASH_FUND_MEMBER_ID)
        );
        if (!kasKlubDoc.exists()) {
          transaction.set(doc(membersColRef, CASH_FUND_MEMBER_ID), {
            name: "Kas Klub",
            balance: 0,
            createdAt: serverTimestamp(),
          });
        } else {
          transaction.update(doc(membersColRef, CASH_FUND_MEMBER_ID), {
            balance: 0,
          });
        }
      } else if (resetType === "monthAgo" || resetType === "dateRange") {
        let startTimestamp = null;
        let endTimestamp = Timestamp.fromDate(new Date()); // Default to now

        if (resetType === "monthAgo") {
          const date = new Date();
          date.setMonth(date.getMonth() - 1);
          date.setDate(1); // Reset from 1st of last month
          date.setHours(0, 0, 0, 0); // Start of the day
          startTimestamp = Timestamp.fromDate(date);
        } else if (resetType === "dateRange") {
          if (!startDate || !endDate) {
            throw new Error("Rentang tanggal tidak valid.");
          }
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          startTimestamp = Timestamp.fromDate(start);
          endTimestamp = Timestamp.fromDate(end);
        }

        // Delete transactions within the range
        const transactionsQuery = query(
          transactionsColRef,
          where("timestamp", ">=", startTimestamp),
          where("timestamp", "<=", endTimestamp)
        );
        const transactionsSnapshot = await getDocs(transactionsQuery);
        transactionsSnapshot.forEach((docSnap) => {
          transaction.delete(docSnap.ref);
        });

        // Delete expenses within the range
        const expensesQuery = query(
          expensesColRef,
          where("timestamp", ">=", startTimestamp),
          where("timestamp", "<=", endTimestamp)
        );
        const expensesSnapshot = await getDocs(expensesQuery);
        expensesSnapshot.forEach((docSnap) => {
          transaction.delete(docSnap.ref);
        });

        // Reset all member balances (including Kas Klub) to 0 for partial reset
        const allMembersSnapshot = await getDocs(membersColRef);
        allMembersSnapshot.forEach((docSnap) => {
          transaction.update(docSnap.ref, { balance: 0 });
        });
      } else {
        throw new Error("Tipe reset tidak valid.");
      }
    });
    _onDataUpdateCallbacks.onMessageBox("Data berhasil direset.", "success");
    return { success: true };
  } catch (error) {
    console.error("Error resetting data:", error);
    _onDataUpdateCallbacks.onMessageBox(
      `Gagal mereset data: ${error.message}`,
      "error"
    );
    return { success: false, message: error.message };
  } finally {
    _onDataUpdateCallbacks.onToggleRefreshSpinner(false);
  }
}
