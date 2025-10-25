import React from "react";
const field = [
  "category",
  "Subject",
  "merchant",
  "Date",
  "Amount",
  "Attachments",
];

const categoryOptions = [
  "Select a category",
  "Fixed deposit",
  "share",
  "Mutual Funds",
  "Other",
];

const containerStyle: React.CSSProperties = {
  height: "100vh",
  backgroundColor: "rgb(40, 39, 39)",
  padding: "30px 30px 30px 0px",
};

const formStyle: React.CSSProperties = {
  backgroundColor: "rgb(0, 0, 0)",
  height: "100%",
  color: "rgb(205, 201, 200)",
  borderRadius: "20px",
  padding: " 3% 3% 3% 3%",
};

const hrStyle: React.CSSProperties = {
  border: "1px solid white",
  margin: "10px 0",
};

const fieldWrapperStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  marginBottom: "15px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: "bold",
  marginBottom: "10px",
  padding: "10px",
  width: "150px",
};

const inputStyle: React.CSSProperties = {
  padding: "10px",
  borderRadius: "5px",
  width: "40%",
  border: "1px solid rgb(205, 201, 200)",
  backgroundColor: "rgb(40, 39, 39)",
  color: "rgb(205, 201, 200)",
};

const Expenses: React.FC = () => {
  return (
    <>
      <div style={containerStyle}>
        <form style={formStyle}>
          <h1>New expense</h1>
          <hr style={hrStyle} />
          {field.map((fieldName) => {
            return (
              <div key={fieldName} style={fieldWrapperStyle}>
                <label htmlFor={fieldName} style={labelStyle}>
                  {fieldName}
                </label>
                {fieldName === "category" ? (
                  <select
                    id={fieldName}
                    name={fieldName.toLowerCase()}
                    style={inputStyle}
                  >
                    {categoryOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : fieldName === "Attachments" ? (
                  <input
                    type="file"
                    id={fieldName}
                    name={fieldName.toLowerCase()}
                    style={inputStyle}
                  />
                ) : (
                  <input
                    type={
                      fieldName === "Total"
                        ? "number"
                        : fieldName === "Date"
                          ? "date"
                          : "text"
                    }
                    id={fieldName}
                    name={fieldName.toLowerCase()}
                    placeholder={`Enter your ${fieldName} here`}
                    style={inputStyle}
                  />
                )}
              </div>
            );
          })}
        </form>
      </div>
    </>
  );
};

export default Expenses;
