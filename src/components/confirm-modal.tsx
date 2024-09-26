import React, { ReactNode } from "react";

import "./confirm-modal.scss";

export interface IConfirmModal {
  title: string;
  message: string|ReactNode;
  onOk: () => void,
  onClose: () => void
}

export const ConfirmModal = ({ title, message, onOk, onClose }: IConfirmModal) => {
  const handleOk = () => {
    onOk();
    onClose();
  };

  return (
    <>
      <div className="confirmModalBackground" />
      <div className="confirmModal">
        <div className="confirmModalContent">
          <div className="confirmModalTitle">{title}</div>
          <div className="confirmModalInnerContent">
            {message}
            <div className="confirmModalButtons">
              <button onClick={handleOk}>Ok</button>
              <button onClick={onClose}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
