"use client";

import { useState } from "react";
import Link from "next/link";
import ConfirmModal from "@/components/ui/ConfirmModal";

export default function CustomersTable({
  customers,
  onUpload,
  onUsers,
  onDelete,
}) {
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    customer: null,
  });

  const openDeleteModal = (customer) => {
    setDeleteModal({
      open: true,
      customer,
    });
  };

  const closeDeleteModal = () => {
    setDeleteModal({
      open: false,
      customer: null,
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteModal.customer) return;

    onDelete(deleteModal.customer);
    closeDeleteModal();
  };

  return (
    <>
      <section className="min-h-0 flex-1 overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
        <div className="h-full overflow-auto">
          <table className="w-full min-w-[980px] border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-[#E2E8F0] text-left text-[11px] font-semibold text-[#475569]">
                <th className="w-[60px] px-5 py-3">ID</th>
                <th className="w-[260px] px-5 py-3">Facility</th>
                <th className="w-[180px] px-5 py-3">City</th>
                <th className="w-[110px] px-5 py-3">Zip</th>
                <th className="w-[110px] px-5 py-3 text-center">Notes</th>
                <th className="w-[110px] px-5 py-3 text-center">Upload</th>
                <th className="w-[110px] px-5 py-3 text-center">Users</th>
                <th className="w-[110px] px-5 py-3 text-center">Delete</th>
              </tr>
            </thead>

            <tbody>
              {customers.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-b border-[#F1F5F9] last:border-b-0 odd:bg-white even:bg-[#F8FBFC] hover:bg-[#F1F9FB]"
                >
                  <td className="px-5 py-4 text-[12px] text-[#64748B]">
                    {customer.id}
                  </td>

                  <td className="px-5 py-4">
                    <button
                      type="button"
                      className="text-left text-[12px] font-semibold text-[#007F96] hover:underline"
                    >
                      {customer.customer}
                    </button>
                  </td>

                  <td className="px-5 py-4 text-[12px] text-[#475569]">
                    {customer.city}
                  </td>

                  <td className="px-5 py-4 text-[12px] text-[#475569]">
                    {customer.zip}
                  </td>

                  <td className="px-5 py-4 text-center">
                    <Link
                      href={`/customers/${customer.id}/notes`}
                      className="inline-flex h-[28px] items-center justify-center gap-2 whitespace-nowrap rounded-[6px] border border-[#67D8E8] bg-[#E6F7FA] px-3 text-[11px] font-semibold text-[#007F96] hover:bg-[#DDF6FA]"
                    >
                      <NotesIcon />
                      Notes
                    </Link>
                  </td>

                  <td className="px-5 py-4 text-center">
                    <button
                      type="button"
                      onClick={() => onUpload(customer)}
                      className="inline-flex h-[28px] items-center justify-center gap-2 whitespace-nowrap rounded-[6px] border border-[#93C5FD] bg-[#EFF6FF] px-3 text-[11px] font-semibold text-[#2563EB] hover:bg-[#DBEAFE]"
                    >
                      <UploadIcon />
                      Upload
                    </button>
                  </td>

                  <td className="px-5 py-4 text-center">
                    <Link
                      href={`/customers/${customer.id}/users`}
                      className="inline-flex h-[28px] items-center justify-center gap-2 whitespace-nowrap rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[11px] font-semibold text-[#334155] hover:bg-[#F1F5F9]"
                    >
                      <UsersIcon />
                      Users
                    </Link>
                  </td>

                  <td className="px-5 py-4 text-center">
                    <button
                      type="button"
                      onClick={() => openDeleteModal(customer)}
                      className="inline-flex h-[28px] items-center justify-center gap-2 whitespace-nowrap rounded-[6px] border border-red-200 bg-red-50 px-3 text-[11px] font-semibold text-red-500 hover:bg-red-100"
                    >
                      <TrashIcon />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {customers.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-[13px] text-[#94A3B8]"
                  >
                    No facilities found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmModal
        open={deleteModal.open}
        title="Delete Facility"
        message={`Are you sure you want to delete ${
          deleteModal.customer?.customer || "this facility"
        }? This action cannot be undone.`}
        variant="danger"
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        onCancel={closeDeleteModal}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

function NotesIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M5 4h14v16H5V4Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 9h8M8 13h6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 16V5M8 9l4-4 4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 19h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
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