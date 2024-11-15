export function customCoordinates(countyName, layer) {
    let coordinates;
    if (countyName === "Bucuresti") {
        coordinates = {
            ...layer.getBounds().getCenter(),
            lng: layer.getBounds().getCenter().lng + 0.4
        }
    } else if (countyName === "Cluj") {
        coordinates = {
            ...layer.getBounds().getCenter(),
            lng: layer.getBounds().getCenter().lng + 0.3
        }
    } else if (countyName === "Constanta") {
        coordinates = {
            ...layer.getBounds().getCenter(),
            lng: layer.getBounds().getCenter().lng + 0.25
        }
    } else if (countyName === "Alba") {
        coordinates = {
            ...layer.getBounds().getCenter(),
            lng: layer.getBounds().getCenter().lng + 0.2,
            lat: layer.getBounds().getCenter().lat + 0.1
        }
    } else if (countyName === "Caras-Severin") {
        coordinates = {
            ...layer.getBounds().getCenter(),
            lng: layer.getBounds().getCenter().lng + 0.2,
            lat: layer.getBounds().getCenter().lat + 0
        }
    } else if (countyName === "Mehedinti") {
        coordinates = {
            ...layer.getBounds().getCenter(),
            lng: layer.getBounds().getCenter().lng + 0.2,
            lat: layer.getBounds().getCenter().lat + 0
        }
    } else if (countyName === "Valcea") {
        coordinates = {
            ...layer.getBounds().getCenter(),
            lng: layer.getBounds().getCenter().lng + 0.15,
            lat: layer.getBounds().getCenter().lat + 0
        }
    } else if (countyName === "Gorj") {
        coordinates = {
            ...layer.getBounds().getCenter(),
            lng: layer.getBounds().getCenter().lng + 0.15,
            lat: layer.getBounds().getCenter().lat + 0
        }
    } else if (countyName === "Tulcea") {
        coordinates = {
            ...layer.getBounds().getCenter(),
            lng: layer.getBounds().getCenter().lng - 0.15,
            lat: layer.getBounds().getCenter().lat - 0.15
        }
        // } else if (countyName === "Iasi") {
        //     coordinates = {
        //         ...layer.getBounds().getCenter(),
        //         lng: layer.getBounds().getCenter().lng + 0.25,
        //         lat: layer.getBounds().getCenter().lat + 0.1,
        //     }
        // } else if (countyName === "Buzau") {
        //     coordinates = {
        //         ...layer.getBounds().getCenter(),
        //         lng: layer.getBounds().getCenter().lng + 0.2,
        //         lat: layer.getBounds().getCenter().lat + 0,
        //     }
    } else {
        coordinates = layer.getBounds().getCenter()
    }
    return coordinates
}