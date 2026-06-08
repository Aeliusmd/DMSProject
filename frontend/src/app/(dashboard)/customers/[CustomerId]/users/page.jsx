"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import ConfirmModal from "@/components/ui/ConfirmModal";

const customers = [
  { id: 1, customer: "Smith & Associates" },
  { id: 2, customer: "Martinez Legal Group" },
  { id: 3, customer: "Pacific Law Partners" },
  { id: 4, customer: "Williams & Co." },
  { id: 5, customer: "Brown Family Trust" },
  { id: 6, customer: "Davis Law Firm" },
  { id: 7, customer: "Rodriguez & Partners" },
  { id: 8, customer: "Thompson Industries" },
  { id: 9, customer: "Garcia Legal Services" },
  { id: 10, customer: "Lee Tech Holdings" },
  { id: 11, customer: "Anderson Accounting" },
  { id: 12, customer: "Taylor Financial Group" },
  { id: 13, customer: "Harrison Medical Group" },
  { id: 14, customer: "O'Connor Legal" },
  { id: 15, customer: "Nelson Healthcare" },
];

const usersByCustomer = {
  1: [
    {
      id: 1,
      name: "Robert Smith",
      email: "r.smith@smithassoc.com",
      level: "Admin",
      job: "Partner",
    },
    {
      id: 2,
      name: "Linda Garcia",
      email: "lgarcia@smithassoc.com",
      level: "Manager",
      job: "Office Manager",
    },
    {
      id: 3,
      name: "Michael Brown",
      email: "mbrown@smithassoc.com",
      level: "User",
      job: "Attorney",
    },
  ],
  2: [
    {
      id: 1,
      name: "Carlos Martinez",
      email: "carlos@martinezlegal.com",
      level: "Admin",
      job: "Partner",
    },
    {
      id: 2,
      name: "Nina Lopez",
      email: "nlopez@martinezlegal.com",
      level: "Manager",
      job: "Office Manager",
    },
    {
      id: 3,
      name: "Daniel Ruiz",
      email: "druiz@martinezlegal.com",
      level: "User",
      job: "Paralegal",
    },
  ],
  3: [
    {
      id: 1,
      name: "Emily Clark",
      email: "emily@pacificlaw.com",
      level: "Admin",
      job: "Attorney",
    },
    {
      id: 2,
      name: "Andrew Hall",
      email: "andrew@pacificlaw.com",
      level: "Manager",
      job: "Office Manager",
    },
    {
      id: 3,
      name: "Grace Miller",
      email: "grace@pacificlaw.com",
      level: "User",
      job: "Legal Assistant",
    },
  ],
  4: [
    {
      id: 1,
      name: "Henry Williams",
      email: "hwilliams@williamsco.com",
      level: "Admin",
      job: "Owner",
    },
    {
      id: 2,
      name: "Olivia Carter",
      email: "ocarter@williamsco.com",
      level: "User",
      job: "Case Coordinator",
    },
  ],
  5: [
    {
      id: 1,
      name: "Patricia Brown",
      email: "pbrown@browntrust.com",
      level: "Admin",
      job: "Trust Manager",
    },
    {
      id: 2,
      name: "Steven Moore",
      email: "smoore@browntrust.com",
      level: "User",
      job: "Assistant",
    },
  ],
  6: [
    {
      id: 1,
      name: "Angela Davis",
      email: "adavis@davislaw.com",
      level: "Admin",
      job: "Attorney",
    },
    {
      id: 2,
      name: "Brian Scott",
      email: "bscott@davislaw.com",
      level: "Manager",
      job: "Office Manager",
    },
    {
      id: 3,
      name: "Melissa Young",
      email: "myoung@davislaw.com",
      level: "User",
      job: "Paralegal",
    },
  ],
  7: [
    {
      id: 1,
      name: "Jose Rodriguez",
      email: "jrodriguez@rodriguezpartners.com",
      level: "Admin",
      job: "Partner",
    },
    {
      id: 2,
      name: "Camila Torres",
      email: "ctorres@rodriguezpartners.com",
      level: "User",
      job: "Legal Assistant",
    },
  ],
  8: [
    {
      id: 1,
      name: "Lisa Thompson",
      email: "lthompson@thompsonindustries.com",
      level: "Admin",
      job: "Operations Director",
    },
    {
      id: 2,
      name: "Kevin Adams",
      email: "kadams@thompsonindustries.com",
      level: "Manager",
      job: "Records Manager",
    },
  ],
  9: [
    {
      id: 1,
      name: "Maria Garcia",
      email: "mgarcia@garcialegal.com",
      level: "Admin",
      job: "Attorney",
    },
    {
      id: 2,
      name: "Chris Walker",
      email: "cwalker@garcialegal.com",
      level: "User",
      job: "Clerk",
    },
  ],
  10: [
    {
      id: 1,
      name: "Thomas Lee",
      email: "tlee@leetech.com",
      level: "Admin",
      job: "Director",
    },
    {
      id: 2,
      name: "Rachel Kim",
      email: "rkim@leetech.com",
      level: "User",
      job: "Compliance Officer",
    },
  ],
  11: [
    {
      id: 1,
      name: "Mark Anderson",
      email: "manderson@andersonaccounting.com",
      level: "Admin",
      job: "CPA",
    },
    {
      id: 2,
      name: "Helen Brooks",
      email: "hbrooks@andersonaccounting.com",
      level: "Manager",
      job: "Accounts Manager",
    },
  ],
  12: [
    {
      id: 1,
      name: "Edward Taylor",
      email: "etaylor@taylorfinancial.com",
      level: "Admin",
      job: "Financial Advisor",
    },
    {
      id: 2,
      name: "Monica Reed",
      email: "mreed@taylorfinancial.com",
      level: "User",
      job: "Assistant",
    },
  ],
  13: [
    {
      id: 1,
      name: "Laura Harrison",
      email: "lharrison@harrisonmedical.com",
      level: "Admin",
      job: "Medical Director",
    },
    {
      id: 2,
      name: "Peter Evans",
      email: "pevans@harrisonmedical.com",
      level: "Manager",
      job: "Records Supervisor",
    },
  ],
  14: [
    {
      id: 1,
      name: "Sean O'Connor",
      email: "soconnor@oconnorlegal.com",
      level: "Admin",
      job: "Attorney",
    },
    {
      id: 2,
      name: "Megan Price",
      email: "mprice@oconnorlegal.com",
      level: "User",
      job: "Legal Secretary",
    },
  ],
  15: [
    {
      id: 1,
      name: "George Nelson",
      email: "gnelson@nelsonhealthcare.com",
      level: "Admin",
      job: "Administrator",
    },
    {
      id: 2,
      name: "Sophia Rivera",
      email: "srivera@nelsonhealthcare.com",
      level: "Manager",
      job: "Office Manager",
    },
    {
      id: 3,
      name: "Ethan Morris",
      email: "emorris@nelsonhealthcare.com",
      level: "User",
      job: "Records Clerk",
    },
  ],
};

export default function CustomerUsersPage() {
  const params = useParams();
  const customerId = getCustomerIdFromParams(params);

  const customer = useMemo(() => {
    return customers.find((item) => item.id === customerId) || customers[0];
  }, [customerId]);

  const [users, setUsers] = useState([]);
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    user: null,
  });

  useEffect(() => {
    setUsers(usersByCustomer[customerId] || usersByCustomer[1]);
  }, [customerId]);

  const openDeleteModal = (user) => {
    setDeleteModal({
      open: true,
      user,
    });
  };

  const closeDeleteModal = () => {
    setDeleteModal({
      open: false,
      user: null,
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteModal.user) return;

    setUsers((prev) => prev.filter((user) => user.id !== deleteModal.user.id));

    console.log("Deleted customer user:", {
      customer,
      user: deleteModal.user,
    });

    closeDeleteModal();
  };

  const handleLogin = (user) => {
    console.log("Login as customer user:", {
      customer,
      user,
    });
  };

  const handleNewUser = () => {
    console.log("Open new user form for customer:", customer);
  };

  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] min-w-0 flex-col gap-5 overflow-hidden">
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-center">
          <h1 className="shrink-0 text-[18px] font-semibold text-[#111827]">
            {customer.customer} - List of Users
          </h1>

          <div className="flex w-full flex-wrap items-center gap-3 lg:ml-auto lg:w-auto lg:justify-end">
            <Link
              href="/orders"
              className="inline-flex h-[36px] items-center justify-center gap-2 whitespace-nowrap rounded-[6px] border border-[#E2E8F0] bg-white px-4 text-[12px] font-semibold text-[#475569] shadow-sm hover:bg-[#F8FAFC]"
            >
              <OrderIcon />
              Orders
            </Link>

     <Link
  href={`/customers/${customerId}/users/new`}
  className="inline-flex h-[36px] items-center justify-center gap-2 whitespace-nowrap rounded-[6px] bg-[#0097B2] px-4 text-[12px] font-semibold text-white shadow-sm hover:bg-[#0086A0]"
>
  <UserPlusIcon />
  New User
</Link>
          </div>
        </div>

        <section className="min-h-0 flex-1 overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
          <div className="h-full overflow-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-[#E2E8F0] text-left text-[11px] font-semibold text-[#475569]">
                  <th className="w-[60px] px-5 py-3">ID</th>
                  <th className="w-[230px] px-5 py-3">User</th>
                  <th className="w-[300px] px-5 py-3">Email</th>
                  <th className="w-[110px] px-5 py-3">Level</th>
                  <th className="w-[160px] px-5 py-3">Job</th>
                  <th className="w-[110px] px-5 py-3 text-center">Delete</th>
                  <th className="w-[110px] px-5 py-3 text-center">Login</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr
                    key={`${customerId}-${user.id}`}
                    className="border-b border-[#F1F5F9] last:border-b-0 odd:bg-white even:bg-[#F8FBFC] hover:bg-[#F1F9FB]"
                  >
                    <td className="px-5 py-4 text-[12px] text-[#64748B]">
                      {user.id}
                    </td>

                    <td className="px-5 py-4">
                      <button
                        type="button"
                        className="text-left text-[12px] font-semibold text-[#007F96] hover:underline"
                      >
                        {user.name}
                      </button>
                    </td>

                    <td className="px-5 py-4 text-[12px] text-[#475569]">
                      {user.email}
                    </td>

                    <td className="px-5 py-4">
                      <LevelBadge level={user.level} />
                    </td>

                    <td className="px-5 py-4 text-[12px] text-[#475569]">
                      {user.job}
                    </td>

                    <td className="px-5 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => openDeleteModal(user)}
                        className="inline-flex h-[28px] items-center justify-center gap-2 whitespace-nowrap rounded-[6px] border border-red-200 bg-red-50 px-3 text-[11px] font-semibold text-red-500 hover:bg-red-100"
                      >
                        <TrashIcon />
                        Delete
                      </button>
                    </td>

                    <td className="px-5 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleLogin(user)}
                        className="inline-flex h-[28px] items-center justify-center gap-2 whitespace-nowrap rounded-[6px] border border-[#86EFAC] bg-[#ECFDF5] px-3 text-[11px] font-semibold text-[#059669] hover:bg-[#DCFCE7]"
                      >
                        <LoginIcon />
                        Login
                      </button>
                    </td>
                  </tr>
                ))}

                {users.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-12 text-center text-[13px] text-[#94A3B8]"
                    >
                      No users found for this customer.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <ConfirmModal
          open={deleteModal.open}
          title="Delete User"
          message={`Are you sure you want to delete ${
            deleteModal.user?.name || "this user"
          }? This action cannot be undone.`}
          variant="danger"
          confirmLabel="Confirm"
          cancelLabel="Cancel"
          onCancel={closeDeleteModal}
          onConfirm={handleConfirmDelete}
        />
      </div>
    </DashboardShell>
  );
}

function getCustomerIdFromParams(params) {
  const rawId =
    params?.customerId ||
    params?.id ||
    params?.customer ||
    params?.customerID ||
    "1";

  const value = Array.isArray(rawId) ? rawId[0] : rawId;
  const parsedId = Number(value);

  return Number.isNaN(parsedId) ? 1 : parsedId;
}

function LevelBadge({ level }) {
  const styles = {
    Admin: "border-[#FCD34D] bg-[#FFFBEB] text-[#B45309]",
    Manager: "border-[#93C5FD] bg-[#EFF6FF] text-[#2563EB]",
    User: "border-[#CBD5E1] bg-[#F1F5F9] text-[#334155]",
  };

  return (
    <span
      className={`inline-flex h-[24px] items-center justify-center rounded-[6px] border px-3 text-[11px] font-semibold ${
        styles[level] || styles.User
      }`}
    >
      {level}
    </span>
  );
}

function OrderIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M5 5h14v14H5V5Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function UserPlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M19 8v6M22 11h-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path
        d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M10 17l5-5-5-5M15 12H3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}