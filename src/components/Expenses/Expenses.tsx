const Expenses: React.FC = () => {
  const field = [
    "Subject",
    "merchant",
    "Date",
    "Total",
    "category",
    "description",
  ];
  return (
    <>
      <div
        style={{
          height: "100vh",
          backgroundColor: "rgb(40, 39, 39)",
          padding: "30px 30px 30px 0px",
        }}
      >
        <form
          style={{
            backgroundColor: "rgb(0, 0, 0)",
            height: "100%",
            color: "rgb(205, 201, 200)",
            borderRadius: "20px",
            padding: " 3% 3% 3% 3%",
          }}
        >
          <h1>New expense</h1>
          <hr style={{ border: "1px solid white", margin: "10px 0" }} />
          {field.map((field) => {
            return (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "15px",
                }}
              >
                <label
                  htmlFor={field}
                  style={{
                    fontSize: "20px",
                    fontWeight: "bold",
                    marginBottom: "10px",
                    padding: "10px",
                    width: "150px",
                  }}
                >
                  {field}
                </label>
                <input
                  type={field === "Total" ? "number" : "text"}
                  id={field}
                  name={field.toLowerCase()}
                  placeholder={`Enter your ${field} here`}
                  style={{
                    padding: "10px",
                    borderRadius: "5px",
                    width: "40%",
                    border: "1px solid rgb(205, 201, 200)",
                    backgroundColor: "rgb(40, 39, 39)",
                    color: "rgb(205, 201, 200)",
                  }}
                />
              </div>
            );
          })}
        </form>
      </div>
    </>
  );
};

export default Expenses;
